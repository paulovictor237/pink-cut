# features/transcription

Owns the audio → text pipeline: invoking the local `parakeet-tdt-0.6b-v3-int8`
model via Tauri commands, parsing the result into time-coded segments, and
exposing them to the editor as the source of truth for cuts.

Public surface will be hooks (`useTranscription`, `useTranscriptionLines`)
backed by a single store.
