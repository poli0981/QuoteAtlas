// QuoteAtlas Tauri shell entry (docs/02 §3). `run()` is shared by the desktop bin
// (src/main.rs) and the mobile entry point. No updater/process/dialog plugins
// (see PR body).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    // Desktop-only plugins. Their crates are declared under a `cfg(not(android/ios))`
    // target in Cargo.toml, so they do not exist at all on mobile — this `cfg` is
    // what keeps the mobile build from referring to absent crates.
    #[cfg(desktop)]
    let builder = builder
        // A second launch must not open a second window: this is a full-screen
        // ambient display, so two copies would fight over the screen. Raise and
        // focus the window that already exists instead.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager as _;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        // The app is left running for hours on a chosen screen; remember where it
        // was put and how big it was.
        .plugin(tauri_plugin_window_state::Builder::default().build());

    builder
        .run(tauri::generate_context!())
        .expect("error while running QuoteAtlas");
}
