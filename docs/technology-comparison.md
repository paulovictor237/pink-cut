# Technology Comparison and Projects Summary

## 1. Tribe-Video-Cleaner
* **Type:** Web Application (Next.js)
* **Purpose:** AI-powered video editing (silence & filler-word removal).
* **Core Stack:** Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI, Zustand, SWR.
* **Media / AI Engine:** `@ffmpeg/ffmpeg` (Wasm), `fluent-ffmpeg`, OpenAI (Whisper), Anthropic (Claude), ElevenLabs (TTS).

## 2. my-video
* **Type:** Declarative HTML/JS Video Composition (HyperFrames)
* **Purpose:** Motion design, dynamic captions, and structured video rendering.
* **Core Stack:** HyperFrames engine (declarative custom HTML custom elements), GSAP, Vanilla JS/CSS.
* **Media / AI Engine:** Headless Chrome rendering to MP4 (Puppeteer/Playwright-driven CLI).

## 3. audapolis
* **Type:** Spoken-word Audio/Video Editor (Electron)
* **Purpose:** Desktop-based wordprocessor-like non-destructive audio/video timeline editing.
* **Core Stack:** Electron, React 17, Vite, Redux Toolkit, Styled Components, Evergreen UI.
* **Media / AI Engine:** Local Python backend (FastAPI), Vosk (offline speech-to-text), OpenTimelineIO, `ffmpeg-static`.

## 4. Handy
* **Type:** Dictation / Clipboard Speech-to-Text Tool (Tauri)
* **Purpose:** Global hotkey-triggered, privacy-focused local voice dictation pasting directly to active fields.
* **Core Stack:** Tauri v2, Rust backend, React 18 frontend, Vite, Tailwind CSS v4, Zustand.
* **Media / AI Engine:** `cpal` (audio capture), `vad-rs` (Silero Voice Activity Detection), `transcribe-rs` (Whisper.cpp / ONNX models locally with Metal/Vulkan GPU acceleration).

## Comparative Technology Matrix

| Capability / Dimension | Tribe-Video-Cleaner | my-video | audapolis | Handy |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime Environment** | Web Browser / Node Server | Headless Browser / Node CLI | Desktop (Electron + local Python Server) | Desktop App (Tauri v2: Rust + Webview) |
| **Frontend Stack** | Next.js 14 + Tailwind CSS v3 | Vanilla HTML/CSS + GSAP | React 17 + Styled Components | React 18 + Tailwind CSS v4 |
| **State Management** | Zustand (Local) + SWR | GSAP Timeline registration | Redux Toolkit + `redux-undo` | Zustand + Tauri-plugin-store |
| **Transcription Method** | Cloud APIs (OpenAI Whisper) | Local pre-processed transcript JSON | Local offline STT (Vosk Engine) | Local offline STT (`transcribe-rs`/Whisper) |
| **Inference Mode** | Online (API keys required) | Static JSON data-driven | Offline-first CPU model | Offline-first (GPU accelerated Metal/Vulkan) |
| **Voice Detection (VAD)** | None (Full-audio file sent) | N/A (Pre-aligned transcript) | Python WebRTCVAD | Rust Silero VAD (`vad-rs` + ONNX runtime) |
| **Core Editing/Action** | Modifies/cuts original footage | Dynamically layers/animates elements | Non-destructive cuts (OpenTimelineIO) | Simulates system key input / clips to clipboard |
| **Operating Footprint** | Low (Heavy lifting on APIs/cloud) | Medium (CLI runs browser renders) | High (Heavy node+python package bundle) | Ultra-light (Rust binary + native OS webview) |
