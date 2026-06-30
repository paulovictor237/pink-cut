//! Local ASR pipeline: extract audio from a video via `ffmpeg`, run the
//! Parakeet TDT model sentence-by-sentence, and shape the result into the
//! `Transcription` contract the frontend already speaks.
//!
//! See `docs/asr-model-decision.md` for the high-level "why Parakeet" and
//! `model_manager.rs` for the download / on-disk layout.

use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use parakeet_rs::{ParakeetTDT, TimestampMode, Transcriber};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::model_manager::{is_model_ready, model_dir};

/// Matches the JS-side `SILENCE_HARD_MS` in `silence-policy.ts`. Duplicated
/// here so the Rust pipeline can classify silences before they ever hit
/// the frontend — keeps the editor's UI policy and the detection policy
/// aligned without round-tripping the data.
const SILENCE_HARD_MS: u64 = 800;

/// Maximum audio length per model call. Parakeet TDT errors out past
/// ~8–10 min on CPU; we cap each chunk at 5 min and overlap by 2 s so
/// sentence boundaries near the cut point don't get truncated.
const CHUNK_LENGTH_SECS: f32 = 300.0;
const CHUNK_OVERLAP_SECS: f32 = 2.0;

/// ─── Tauri-visible types ───────────────────────────────────────────────────

/// Public shape returned by the `transcribe_path` command. Field names and
/// units are kept 1:1 with the frontend `Transcription` type so the JSON
/// payload crosses the boundary without a transformation layer.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transcription {
    pub version: u8,
    pub language: String,
    pub duration_ms: u64,
    pub segments: Vec<TranscriptionSegment>,
    pub silences: Vec<Silence>,
    pub created_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionSegment {
    pub id: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub words: Vec<WordTiming>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
    /// Parakeet TDT doesn't expose per-word confidence; we leave it null
    /// so the UI can render a uniform style.
    pub confidence: Option<f32>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Silence {
    pub start_ms: u64,
    pub end_ms: u64,
    /// "soft" or "hard" — see SILENCE_HARD_MS.
    pub kind: String,
}

#[derive(Clone, Serialize)]
#[serde(tag = "stage", rename_all = "snake_case")]
pub enum TranscribeProgress {
    /// Checking ffmpeg + loading the model into memory.
    Preparing { message: String },
    /// Decoding audio from the video.
    Decoding { message: String, ratio: f32 },
    /// Model is running over audio chunks.
    Inferring { message: String, ratio: f32 },
    /// Final assembly of segments + silences.
    Assembling { message: String },
    /// Transcription ready.
    Done { transcription: Transcription },
}

// ─── Entry point ────────────────────────────────────────────────────────────

/// Run the full pipeline on a local video file. Streams progress events on
/// the `transcribe://progress` Tauri channel.
pub fn transcribe_path(app: &AppHandle, video_path: String) -> Result<Transcription, String> {
    if !is_model_ready(app) {
        return Err(
            "Modelo ASR ainda não foi baixado. Abra Configurações para instalar o Parakeet TDT."
                .to_string(),
        );
    }
    if which_ffmpeg().is_none() {
        return Err(
            "ffmpeg não foi encontrado no PATH. Instale com `brew install ffmpeg` (macOS) ou o equivalente da sua distribuição."
                .to_string(),
        );
    }

    emit(
        &app,
        TranscribeProgress::Preparing {
            message: "Carregando modelo Parakeet TDT…".into(),
        },
    );
    let model_dir = model_dir(&app)?;
    let mut parakeet = ParakeetTDT::from_pretrained(&model_dir, None).map_err(|e| {
        format!(
            "Falha ao carregar o modelo em `{}`: {e}. Verifique se os 3 arquivos ONNX estão presentes.",
            model_dir.display()
        )
    })?;

    emit(
        &app,
        TranscribeProgress::Decoding {
            message: "Extraindo áudio do vídeo com ffmpeg…".into(),
            ratio: 0.0,
        },
    );
    let audio = extract_pcm16k_mono(&video_path)?;
    let total_samples = audio.len();
    let total_secs = total_samples as f32 / 16_000.0;

    // Split into overlapping chunks.
    let chunk_len = (CHUNK_LENGTH_SECS * 16_000.0) as usize;
    let overlap = (CHUNK_OVERLAP_SECS * 16_000.0) as usize;
    let step = chunk_len.saturating_sub(overlap).max(1);
    let mut chunks: Vec<(usize, Vec<f32>)> = Vec::new();
    let mut start = 0usize;
    while start < total_samples {
        let end = (start + chunk_len).min(total_samples);
        chunks.push((start, audio[start..end].to_vec()));
        if end == total_samples {
            break;
        }
        start += step;
    }
    if chunks.is_empty() {
        return Err("Áudio vazio ou inválido.".into());
    }

    // Run the model over each chunk, merging tokens into one timeline.
    let mut all_tokens: Vec<RawToken> = Vec::new();
    for (i, (offset_samples, chunk)) in chunks.iter().enumerate() {
        let ratio = (i as f32 + 1.0) / (chunks.len() as f32);
        emit(
            &app,
            TranscribeProgress::Inferring {
                message: format!("Transcrevendo trecho {}/{}…", i + 1, chunks.len()),
                ratio,
            },
        );

        let result = parakeet
            .transcribe_samples(chunk.clone(), 16_000, 1, Some(TimestampMode::Sentences))
            .map_err(|e| format!("Parakeet falhou no trecho {}/{}: {e}", i + 1, chunks.len()))?;

        let offset_secs = (*offset_samples as f32) / 16_000.0;
        for tok in result.tokens {
            // Skip tokens that fall inside the overlap region of the
            // previous chunk (we already transcribed them).
            if i > 0 && tok.start < CHUNK_OVERLAP_SECS {
                continue;
            }
            all_tokens.push(RawToken {
                text: tok.text,
                start_secs: tok.start + offset_secs,
                end_secs: tok.end + offset_secs,
            });
        }
    }

    emit(
        &app,
        TranscribeProgress::Assembling {
            message: "Montando segmentos e silêncios…".into(),
        },
    );

    let segments = build_segments(&all_tokens);
    let silences = build_silences(&segments, total_secs);
    let duration_ms = (total_secs * 1000.0).round() as u64;

    let transcription = Transcription {
        version: 1,
        language: "pt".into(),
        duration_ms,
        segments,
        silences,
        created_at: now_ms(),
    };

    emit(
        &app,
        TranscribeProgress::Done {
            transcription: transcription.clone(),
        },
    );
    Ok(transcription)
}

#[derive(Debug, Clone)]
struct RawToken {
    text: String,
    start_secs: f32,
    end_secs: f32,
}

fn build_segments(tokens: &[RawToken]) -> Vec<TranscriptionSegment> {
    // The TDT model already groups tokens by sentence when we ask for
    // `TimestampMode::Sentences`; we trust those boundaries and split
    // `text` into word-level timings by proportional allocation within
    // the token's [start, end] window. This is the documented v1
    // limitation — see `docs/asr-model-decision.md`.
    let mut segments = Vec::new();
    for (i, tok) in tokens.iter().enumerate() {
        let start_ms = (tok.start_secs * 1000.0).round() as u64;
        let end_ms = (tok.end_secs * 1000.0).round() as u64;
        if end_ms <= start_ms {
            continue;
        }
        let words = split_words(&tok.text, start_ms, end_ms);
        if words.is_empty() {
            continue;
        }
        segments.push(TranscriptionSegment {
            id: format!("seg_{i}"),
            start_ms,
            end_ms,
            words,
        });
    }
    segments
}

fn split_words(text: &str, start_ms: u64, end_ms: u64) -> Vec<WordTiming> {
    let tokens: Vec<&str> = text.split_whitespace().collect();
    if tokens.is_empty() {
        return Vec::new();
    }
    let span = end_ms.saturating_sub(start_ms).max(1);
    // Estimate per-word duration by char count, then snap to a min of
    // 1 ms so we never emit a zero-width word that would confuse the UI.
    let total_chars: usize = tokens.iter().map(|t| t.chars().count().max(1)).sum();
    let mut words = Vec::with_capacity(tokens.len());
    let mut cursor = start_ms;
    for (i, tok) in tokens.iter().enumerate() {
        let chars = tok.chars().count().max(1);
        let word_end = if i + 1 == tokens.len() {
            end_ms
        } else {
            cursor + ((chars as u64) * span) / (total_chars as u64).max(1)
        };
        let word_end = word_end.max(cursor + 1).min(end_ms);
        words.push(WordTiming {
            start_ms: cursor,
            end_ms: word_end,
            text: (*tok).to_string(),
            confidence: None,
        });
        cursor = word_end;
    }
    words
}

fn build_silences(segments: &[TranscriptionSegment], total_secs: f32) -> Vec<Silence> {
    let mut silences = Vec::new();
    for w in segments.windows(2) {
        let gap_start = w[0].end_ms;
        let gap_end = w[1].start_ms;
        if gap_end > gap_start {
            let duration = gap_end - gap_start;
            let kind = if duration >= SILENCE_HARD_MS {
                "hard"
            } else {
                "soft"
            };
            silences.push(Silence {
                start_ms: gap_start,
                end_ms: gap_end,
                kind: kind.to_string(),
            });
        }
    }
    // Trailing silence: anything after the last segment up to the end of
    // the audio. Most "is this a hard cut?" decisions happen here.
    if let Some(last) = segments.last() {
        let total_ms = (total_secs * 1000.0).round() as u64;
        if total_ms > last.end_ms + 50 {
            silences.push(Silence {
                start_ms: last.end_ms,
                end_ms: total_ms,
                kind: "soft".into(),
            });
        }
    }
    silences
}

fn emit(app: &AppHandle, p: TranscribeProgress) {
    let _ = app.emit("transcribe://progress", p);
}

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ─── ffmpeg + WAV decode ────────────────────────────────────────────────────

/// Find the first available `ffmpeg` binary on `$PATH`. Returns the version
/// string when found, so the UI can show "ffmpeg 7.0" or similar.
pub fn detect_ffmpeg() -> Option<String> {
    which_ffmpeg().and_then(|path| {
        let out = Command::new(&path).arg("-version").output().ok()?;
        if !out.status.success() {
            return None;
        }
        let s = String::from_utf8_lossy(&out.stdout);
        s.lines().next().map(|l| l.to_string())
    })
}

fn which_ffmpeg() -> Option<PathBuf> {
    for cand in ["ffmpeg"] {
        if let Ok(p) = which(cand) {
            return Some(p);
        }
    }
    // Common macOS Homebrew locations not on PATH (e.g. GUI apps).
    for p in [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ] {
        if std::path::Path::new(p).exists() {
            return Some(PathBuf::from(p));
        }
    }
    None
}

fn which(cmd: &str) -> std::io::Result<PathBuf> {
    let path = std::env::var_os("PATH").unwrap_or_default();
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(cmd);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        format!("{cmd} not on PATH"),
    ))
}

/// Extract a video's audio to a 16 kHz mono f32 PCM buffer. We shell out
/// to ffmpeg and stream raw little-endian int16 PCM to stdout (no WAV
/// container — ffmpeg's pipe writer can produce WAVs whose data chunk
/// length is misaligned, which trips `hound` even though the audio itself
/// is fine). Skipping the container also means the ffmpeg invocation is
/// ~3× faster on long videos.
fn extract_pcm16k_mono(video_path: &str) -> Result<Vec<f32>, String> {
    let ffmpeg = which_ffmpeg().ok_or_else(|| {
        "ffmpeg não encontrado no PATH nem em locais comuns do macOS.".to_string()
    })?;

    let mut child = Command::new(&ffmpeg)
        .args([
            "-nostdin",
            "-hide_banner",
            "-loglevel", "error",
            "-i", video_path,
            "-ar", "16000",
            "-ac", "1",
            "-f", "s16le",
            "-acodec", "pcm_s16le",
            "pipe:1",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Falha ao iniciar ffmpeg: {e}. Verifique se o vídeo existe e o ffmpeg está instalado."))?;

    let mut stdout = child.stdout.take().ok_or("ffmpeg stdout indisponível")?;
    let mut raw_bytes = Vec::new();
    stdout
        .read_to_end(&mut raw_bytes)
        .map_err(|e| format!("lendo saída do ffmpeg: {e}"))?;
    let status = child
        .wait()
        .map_err(|e| format!("aguardando ffmpeg: {e}"))?;
    if !status.success() {
        let mut err = String::new();
        let _ = child.stderr.map(|mut s| s.read_to_string(&mut err));
        return Err(format!("ffmpeg falhou (exit {status}): {err}"));
    }

    // Defensive: trim a trailing partial sample. ffmpeg's pipe writer
    // shouldn't produce this with `-f s16le`, but if it ever does we'd
    // rather drop half a millisecond of audio than panic.
    let usable = raw_bytes.len() - (raw_bytes.len() % 2);
    let mut samples = Vec::with_capacity(usable / 2);
    for chunk in raw_bytes[..usable].chunks_exact(2) {
        let s = i16::from_le_bytes([chunk[0], chunk[1]]);
        samples.push(s as f32 / 32_768.0);
    }
    Ok(samples)
}
