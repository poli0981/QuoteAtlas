// QuoteAtlas Tauri shell entry (docs/02 §3). `run()` is shared by the desktop bin
// (src/main.rs) and the mobile entry point. Only the all-platform plugins are
// registered this round — the desktop-only single-instance + window-state plugins
// are added in the desktop round. No updater/process/dialog plugins (see PR body).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running QuoteAtlas");
}
