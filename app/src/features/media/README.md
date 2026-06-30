# features/media

Wraps the native video player and the import/export flow. Talks to the
Tauri shell for file dialogs, file system access, and rendering the final
video. Exposes `<VideoPlayer />` and hooks like `useMediaFile`.
