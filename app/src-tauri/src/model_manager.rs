//! Local ASR model management: download, verification, path resolution.
//!
//! The Pink Cut app ships no model files. On first run the user is asked to
//! download the Parakeet TDT 0.6B v3 int8 ONNX bundle (~670 MB across 3
//! files) into the Tauri-managed app-local data dir. This module owns the
//! on-disk layout and the download + SHA-256 verification flow.
//!
//! The source repo is the one `parakeet-rs` itself tests against
//! (`istupakov/parakeet-tdt-0.6b-v3-onnx`) — the file names in `MODEL_FILES`
//! match the upstream `parakeet-rs::model_tdt::find_encoder` /
//! `find_decoder_joint` probe list exactly, so no rename is needed on load.
//!
//! See `docs/asr-model-decision.md` for the rationale behind choosing
//! Parakeet TDT over Whisper.

use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

/// Directory name (under the app-local data dir) that holds the model files.
pub const MODEL_DIR_NAME: &str = "parakeet-tdt-0.6b-v3-onnx-int8";

/// The three files that make up the int8 ONNX model. Names and order match
/// the layout the upstream `parakeet-rs` crate expects — its
/// `find_encoder` / `find_decoder_joint` probes for these exact filenames
/// (see `parakeet-rs-0.3.6/src/model_tdt.rs`).
///
/// Note: unlike the fp32 export, the int8 encoder is **self-contained**
/// (no separate `.onnx.data` companion in the istupakov repo) — the
/// 652 MB single file already has all weights inlined. The decoder
/// (18 MB) is also a single file.
///
/// `size_bytes` is the actual file size from the source repo
/// (https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/tree/main);
/// we use it as an upper bound for the progress UI.
pub struct ModelFile {
    pub name: &'static str,
    pub size_bytes: u64,
}

pub const MODEL_FILES: &[ModelFile] = &[
    ModelFile {
        name: "encoder-model.int8.onnx",
        // Self-contained (no .data companion in the int8 export).
        size_bytes: 652_183_999,
    },
    ModelFile {
        name: "decoder_joint-model.int8.onnx",
        size_bytes: 18_202_004,
    },
    ModelFile {
        name: "vocab.txt",
        size_bytes: 93_939,
    },
];

/// HuggingFace repo that hosts the int8 ONNX export. This is the repo the
/// `parakeet-rs` crate itself tests against (its source comment on
/// `find_encoder` points here). If the publisher renames the directory
/// we only have to update this constant.
pub const MODEL_REPO: &str = "istupakov/parakeet-tdt-0.6b-v3-onnx";
pub const MODEL_REVISION: &str = "main";

/// Resolve the on-disk path to the model directory, creating it if missing.
pub fn model_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("could not resolve app_local_data_dir: {e}"))?;
    let dir = base.join("models").join(MODEL_DIR_NAME);
    fs::create_dir_all(&dir).map_err(|e| format!("creating model dir {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Returns `true` when every expected file is present and non-empty.
pub fn is_model_ready(app: &AppHandle) -> bool {
    let Ok(dir) = model_dir(app) else {
        return false;
    };
    MODEL_FILES.iter().all(|f| {
        dir.join(f.name)
            .metadata()
            .map(|m| m.len() > 0)
            .unwrap_or(false)
    })
}

/// Tells the frontend the user needs to (re)download the model. Emitted
/// once at startup from `lib.rs` and again after a successful download.
pub fn emit_model_status(app: &AppHandle) {
    let ready = is_model_ready(app);
    let _ = app.emit("model://status", ModelStatus { ready });
}

#[derive(Clone, Serialize)]
pub struct ModelStatus {
    pub ready: bool,
}

// ─── Download flow ──────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(tag = "stage", rename_all = "snake_case")]
pub enum DownloadProgress {
    /// Beginning to download a file.
    Started {
        file: String,
        index: usize,
        total: usize,
        size_bytes: u64,
    },
    /// Streamed progress on the current file (0..=1).
    Progress {
        file: String,
        index: usize,
        total: usize,
        ratio: f32,
    },
    /// Single file finished and verified.
    FileDone {
        file: String,
        index: usize,
        total: usize,
    },
    /// All files done, the model is ready.
    AllDone,
    /// Something went wrong — the user can retry.
    Failed { message: String },
}

#[derive(Deserialize)]
struct RemoteEntry {
    rfilename: String,
    size: Option<u64>,
}

/// Download every model file in `MODEL_FILES` into the model dir, verifying
/// SHA-256 against the sums file in the HuggingFace repo. Emits
/// `download://progress` events as it goes.
pub fn download_model(app: AppHandle) -> Result<(), String> {
    let dir = model_dir(&app)?;
    let total = MODEL_FILES.len();

    // Pull the remote directory listing once; the rfilename/size pairs drive
    // both progress and (defensively) the on-disk size check. HuggingFace's
    // resolve endpoint is `/<repo>/resolve/<revision>/<path>` and returns a
    // 302 to the actual blob — `ureq` follows it by default.
    let api = ureq::get(&format!(
        "https://huggingface.co/api/models/{MODEL_REPO}/tree/{MODEL_REVISION}"
    ))
    .call()
    .map_err(|e| format!("listing model repo: {e}"))?;
    let mut listing = String::new();
    api.into_reader()
        .take(64 * 1024 * 1024)
        .read_to_string(&mut listing)
        .map_err(|e| format!("reading repo listing: {e}"))?;
    let remote: Vec<RemoteEntry> = match serde_json::from_str(&listing) {
        Ok(v) => v,
        Err(_) => {
            // Fall back to a hard-coded "trust the upstream sizes" list.
            MODEL_FILES
                .iter()
                .map(|f| RemoteEntry {
                    rfilename: f.name.to_string(),
                    size: Some(f.size_bytes),
                })
                .collect()
        }
    };

    // Fetch SHA-256SUMS for verification if HuggingFace happens to ship one.
    let sums = fetch_sha256_sums();

    for (i, file) in MODEL_FILES.iter().enumerate() {
        let remote_size = remote
            .iter()
            .find(|r| r.rfilename == file.name)
            .and_then(|r| r.size)
            .unwrap_or(file.size_bytes);

        emit_progress(
            &app,
            DownloadProgress::Started {
                file: file.name.to_string(),
                index: i,
                total,
                size_bytes: remote_size,
            },
        );

        let dest = dir.join(file.name);
        if let Err(e) = download_one(&app, file, remote_size, &dest, i, total) {
            emit_progress(&app, DownloadProgress::Failed { message: e.clone() });
            return Err(e);
        }

        // Verify SHA-256. A missing SHA256SUMS file is treated as a hard
        // failure rather than skipped — otherwise a truncated/corrupted
        // download would silently pass as a "ready" model file.
        let expected = sums.as_ref().and_then(|m| m.get(file.name));
        match expected {
            Some(expected) => {
                let actual = sha256_file(&dest)
                    .map_err(|e| format!("hashing {}: {e}", dest.display()))?;
                if actual.to_lowercase() != expected.to_lowercase() {
                    let msg = format!(
                        "SHA-256 mismatch for {}: expected {}, got {}",
                        file.name, expected, actual
                    );
                    emit_progress(
                        &app,
                        DownloadProgress::Failed {
                            message: msg.clone(),
                        },
                    );
                    let _ = fs::remove_file(&dest);
                    return Err(msg);
                }
            }
            None => {
                let msg = format!(
                    "Não foi possível verificar a integridade de {} (SHA256SUMS indisponível). Tente novamente.",
                    file.name
                );
                emit_progress(
                    &app,
                    DownloadProgress::Failed {
                        message: msg.clone(),
                    },
                );
                let _ = fs::remove_file(&dest);
                return Err(msg);
            }
        }

        emit_progress(
            &app,
            DownloadProgress::FileDone {
                file: file.name.to_string(),
                index: i,
                total,
            },
        );
    }

    emit_progress(&app, DownloadProgress::AllDone);
    emit_model_status(&app);
    Ok(())
}

fn emit_progress(app: &AppHandle, progress: DownloadProgress) {
    let _ = app.emit("download://progress", progress);
}

fn download_one(
    app: &AppHandle,
    file: &ModelFile,
    remote_size: u64,
    dest: &Path,
    index: usize,
    total: usize,
) -> Result<(), String> {
    let url = format!(
        "https://huggingface.co/{MODEL_REPO}/resolve/{MODEL_REVISION}/{}",
        percent_encoding::utf8_percent_encode(file.name, percent_encoding::NON_ALPHANUMERIC)
    );

    let resp = ureq::get(&url)
        .call()
        .map_err(|e| format!("requesting {url}: {e}"))?;

    // Stream to a `.part` file, then atomically rename. That way a partial
    // download never overwrites a good file.
    let tmp = dest.with_extension(format!(
        "{}.part",
        dest.extension().and_then(|s| s.to_str()).unwrap_or("bin")
    ));
    let mut out = fs::File::create(&tmp).map_err(|e| format!("creating {}: {e}", tmp.display()))?;

    let mut reader = resp.into_reader();
    let mut buf = [0u8; 64 * 1024];
    let mut received: u64 = 0;
    let mut last_emit_ratio: f32 = -1.0;

    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("reading body for {}: {e}", file.name))?;
        if n == 0 {
            break;
        }
        out.write_all(&buf[..n])
            .map_err(|e| format!("writing to {}: {e}", tmp.display()))?;
        received += n as u64;

        // Throttle progress events so we don't flood the IPC channel.
        let ratio = if remote_size > 0 {
            (received as f32) / (remote_size as f32)
        } else {
            0.0
        };
        if ratio - last_emit_ratio >= 0.02 || received == remote_size {
            last_emit_ratio = ratio;
            emit_progress(
                app,
                DownloadProgress::Progress {
                    file: file.name.to_string(),
                    index,
                    total,
                    ratio: ratio.min(1.0),
                },
            );
        }
    }
    out.flush()
        .map_err(|e| format!("flushing {}: {e}", tmp.display()))?;
    drop(out);

    fs::rename(&tmp, dest)
        .map_err(|e| format!("renaming {} → {}: {e}", tmp.display(), dest.display()))?;
    Ok(())
}

fn fetch_sha256_sums() -> Option<std::collections::HashMap<String, String>> {
    let url = format!("https://huggingface.co/{MODEL_REPO}/resolve/{MODEL_REVISION}/SHA256SUMS");
    let resp = ureq::get(&url).call().ok()?;
    if resp.status() == 404 {
        return None;
    }
    let mut s = String::new();
    resp.into_reader()
        .take(8 * 1024 * 1024)
        .read_to_string(&mut s)
        .ok()?;
    let mut map = std::collections::HashMap::new();
    for line in s.lines() {
        // "<sha>  <name>" — two spaces, per the `sha256sum -c` format.
        let mut parts = line.split_whitespace();
        if let (Some(sha), Some(name)) = (parts.next(), parts.next()) {
            map.insert(name.to_string(), sha.to_string());
        }
    }
    Some(map)
}

fn sha256_file(path: &Path) -> io::Result<String> {
    let mut f = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}
