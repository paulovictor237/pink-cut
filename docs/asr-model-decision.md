# ASR ( Automatic Speech Recognition) Model Decision — Pink Cut

> Decision document: which local open-source AI model(s) power word-level transcription + silence detection in Pink Cut.
> Status: **Adopted** — research concluded, stack locked.

---

## 1. Requirements (from `AGENTS.md`)

Pink Cut is a Descript-style video editor built on **Tauri + React**, with local-only AI inference. The model must:

| # | Requirement | Why |
|---|---|---|
| R1 | **Word-level timestamps** | Editing text = cutting audio. Powers *Filter Words* ("hum", "tipo") and *Double Takes*. |
| R2 | **Silence detection** | Powers *Silence Cuts*; silences render visually as the 𝄾 *quarter rest*. |
| R3 | **Runs 100 % local & open-source** | "IA Local", privacy-first, no API keys, fits the Tauri sandbox. |
| R4 | **CPU-friendly** | Most users won't have a discrete GPU. |
| R5 | **Multi-language (incl. pt-BR)** | Pink Cut's primary users are Brazilian creators. |
| R6 | **Active in 2026** | Maintained, recent releases, healthy community. |

---

## 2. Evaluation Criteria & Weights

| Criterion | Weight |
|---|---|
| Word-level timestamp support (built-in or via flag) | 25 % |
| Transcription accuracy (WER on open benchmarks) | 20 % |
| Local-first license (MIT / Apache / CC-BY) | 15 % |
| CPU performance (RTFx) | 15 % |
| Multi-language coverage (≥25 langs incl. pt) | 10 % |
| Maturity / community / maintenance | 10 % |
| Integration ergonomics in Tauri/Rust | 5 % |

---

## 3. Top 3 Candidates

### 🥇 1. NVIDIA Parakeet TDT 0.6B v3 — **adopted as default**

| Spec | Value |
|---|---|
| HF repo | [`nvidia/parakeet-tdt-0.6b-v3`](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) |
| Released | August 2025 |
| Parameters | 600 M |
| WER (HF Open-ASR leaderboard) | **6.34 %** — best in its size class |
| Word-level timestamps | ✅ **Built-in** (word + segment + char) — no flag needed |
| Languages | 25 European, auto-detect (incl. **pt**) |
| RTFx on CPU (i5) | ~3,380× — ~5× real-time |
| Export | ONNX (consumed in Rust via `ort`) |
| License | **CC-BY-4.0** |
| Int8 ONNX source | [`istupakov/parakeet-tdt-0.6b-v3-onnx`](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/tree/main) — the same repo `parakeet-rs` itself tests against; total ~670 MB across 3 files (`encoder-model.int8.onnx`, `decoder_joint-model.int8.onnx`, `vocab.txt`) |

**Why #1:** Best accuracy/size trade-off in 2026, native word-level output (no experimental flag), tiny footprint, CPU-fast, supports Portuguese. This is the model the Handy reference (closest Tauri-v2 analogue) ships as the CPU default, and it matches the model already named in `AGENTS.md`.

### 🥈 2. OpenAI Whisper Large-v3 Turbo (via `whisper.cpp`) — **opt-in power user model**

| Spec | Value |
|---|---|
| Repo | [`ggerganov/whisper.cpp`](https://github.com/ggerganov/whisper.cpp) |
| Parameters | ~809 M (decoder-pruned "Turbo") |
| WER (English) | ~7–8 % |
| Word-level timestamps | ⚠️ via experimental `-ml 1` flag (battle-tested in Handy) |
| Languages | 99 |
| Quantized file | `ggml-large-v3-turbo-q8_0.bin` (~1.5 GB) |
| License | **MIT** |
| Hardware | CPU, Apple Metal, CUDA, Vulkan, CoreML |

**Why #2:** Most mature local ASR, widest community, best language coverage, Metal/CUDA acceleration on beefy machines. Use as a fallback for niche languages or as opt-in for users with a strong GPU.

### 🥉 3. Whisper Small / Medium (via `whisper.cpp`) — **low-end hardware tier**

| Spec | Value |
|---|---|
| Quantized sizes | Small `q8` ≈ 488 MB · Medium `q8` ≈ 1.5 GB |
| WER | Small ~10 % · Medium ~8.5 % |
| Word-level timestamps | ✅ via `-ml 1` |
| License | MIT |
| Best for | Older laptops, low RAM, fast first-pass preview |

**Why #3:** Floor for usable editing. Lets users with 2015-era hardware still benefit from Pink Cut without buying new gear.

---

## 4. Companion Model — Silero VAD (mandatory for silence detection)

| Spec | Value |
|---|---|
| Role | Voice Activity Detection — finds speech vs. non-speech |
| Size | ~2 MB ONNX |
| License | MIT |
| Rust crate | [`vad-rs`](https://crates.io/crates/vad-rs) |
| Output | Time-stamped speech segments → rendered as 𝄾 in the transcript |

Silero is the de-facto local VAD. `whisper.cpp` also ships it built-in, so Whisper users can skip the extra crate. For Parakeet (the default), Silero runs explicitly to mark silences, since Parakeet emits word tokens but does not segment silences the same way.

---

## 5. Final Decision

**Pink Cut ships with a tiered model lineup, all run locally, all open-source:**

1. **Default → Parakeet TDT 0.6B v3 (int8 ONNX)** — best 2026 accuracy/size, built-in word-level, CPU-fast, supports pt.
2. **Power-user opt-in → Whisper Large-v3 Turbo** — for GPU users or non-EU languages.
3. **Low-end opt-in → Whisper Small/Medium** — for older machines.
4. **Silence detection → Silero VAD** — always on, independent of transcription model.

**Architecture pattern (mirrors Handy):**
- `transcribe-rs` (Rust crate) with features `["whisper-cpp", "onnx"]` — single API for both Whisper and Parakeet.
- `vad-rs` (Silero) — produces the 𝄾 silence marks.
- `ort` (ONNX runtime) — runs Parakeet on CPU/Metal/CUDA.
- Models downloaded once, stored under `src-tauri/models/`, lazy-loaded on first transcription.

### Considered & rejected

| Model | Reason rejected |
|---|---|
| **Moonshine (UsefulSensors)** | English-only, no native word-level timestamps, WER ~9.99 %. Useful for streaming captions, not for editing. |
| **Vosk** (used by audapolis) | Lower accuracy, coarser word timestamps, forces a Python side-car inside Tauri. |
| **Canary / Granite-Speech** | Heavier (1B+), less quantization-friendly for local CPU. |
| **Cloud Whisper API / ElevenLabs** | Violates the "IA Local" rule from `AGENTS.md`. |

---

## 6. References

- Pink Cut spec: `AGENTS.md`
- Reference projects: `inspirations/references.md` → [Tribe-Video-Cleaner](https://github.com/grafup/Tribe-Video-Cleaner), [audapolis](https://github.com/bugbakery/audapolis), [Handy](https://github.com/cjpais/handy)
- Closer architectural comparison: `docs/technology-comparison.md`
- Proven Tauri + Silero + Whisper/Parakeet wiring: `inspirations/handy/src-tauri/Cargo.toml` (`transcribe-rs` with `whisper-cpp` + `onnx` features, `vad-rs`)
- Model cards: [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
