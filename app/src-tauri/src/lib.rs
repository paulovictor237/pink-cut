//! Tauri backend entry point.
//!
//! Wires up the plugins and the local ASR commands. See
//! `docs/asr-model-decision.md` for the high-level architecture.

mod model_manager;
mod transcription;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Tell the frontend whether the model is already on disk.
            // The UI uses this to decide whether to show the download
            // banner on first launch.
            model_manager::emit_model_status(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::transcribe_path,
            commands::download_model,
            commands::is_model_ready,
            commands::detect_ffmpeg,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Thin Tauri command shims. Keeping them in one place avoids sprinkling
/// `#[tauri::command]` across the modules and gives us a single registry
/// to inspect when adding a new IPC entry point.
mod commands {
    use tauri::AppHandle;

    #[tauri::command]
    pub async fn transcribe_path(
        app: AppHandle,
        path: String,
    ) -> Result<super::transcription::Transcription, String> {
        // The model + ffmpeg pipeline is CPU-heavy; run it on a blocking
        // thread so the IPC event loop stays responsive and the UI can
        // keep rendering progress events.
        tauri::async_runtime::spawn_blocking(move || {
            super::transcription::transcribe_path(&app, path)
        })
        .await
        .map_err(|e| format!("join error: {e}"))?
    }

    #[tauri::command]
    pub async fn download_model(app: AppHandle) -> Result<(), String> {
        tauri::async_runtime::spawn_blocking(move || super::model_manager::download_model(app))
            .await
            .map_err(|e| format!("join error: {e}"))?
    }

    #[tauri::command]
    pub fn is_model_ready(app: AppHandle) -> bool {
        super::model_manager::is_model_ready(&app)
    }

    #[tauri::command]
    pub fn detect_ffmpeg() -> Option<String> {
        super::transcription::detect_ffmpeg()
    }
}
