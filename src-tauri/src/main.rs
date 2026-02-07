// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod wake_word;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
};
// use tauri_plugin_autostart::MacosLauncher;  // Disabled for now

// Global state for wake word detection
static WAKE_WORD_ENABLED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn enable_wake_word(app: AppHandle) -> Result<String, String> {
    if WAKE_WORD_ENABLED.load(Ordering::SeqCst) {
        return Ok("Wake word already enabled".to_string());
    }

    WAKE_WORD_ENABLED.store(true, Ordering::SeqCst);

    // Start wake word detection in background thread
    let app_handle = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = wake_word::start_detection(app_handle) {
            log::error!("Wake word detection error: {}", e);
        }
    });

    Ok("Wake word detection enabled".to_string())
}

#[tauri::command]
fn disable_wake_word() -> Result<String, String> {
    WAKE_WORD_ENABLED.store(false, Ordering::SeqCst);
    Ok("Wake word detection disabled".to_string())
}

#[tauri::command]
fn is_wake_word_enabled() -> bool {
    WAKE_WORD_ENABLED.load(Ordering::SeqCst)
}

#[tauri::command]
fn show_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn hide_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub fn is_detection_enabled() -> bool {
    WAKE_WORD_ENABLED.load(Ordering::SeqCst)
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        // Autostart disabled for now - can be added later
        // .plugin(tauri_plugin_autostart::init(
        //     MacosLauncher::LaunchAgent,
        //     Some(vec!["--hidden"]),
        // ))
        .setup(|app| {
            // Create tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Chief", true, None::<&str>)?;
            let wake_word_item = MenuItem::with_id(app, "wake_word", "Enable Wake Word", true, None::<&str>)?;
            let separator = MenuItem::with_id(app, "sep", "---", false, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &wake_word_item, &separator, &quit_item])?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "wake_word" => {
                            if WAKE_WORD_ENABLED.load(Ordering::SeqCst) {
                                WAKE_WORD_ENABLED.store(false, Ordering::SeqCst);
                                log::info!("Wake word detection disabled");
                            } else {
                                WAKE_WORD_ENABLED.store(true, Ordering::SeqCst);
                                let app_handle = app.clone();
                                std::thread::spawn(move || {
                                    if let Err(e) = wake_word::start_detection(app_handle) {
                                        log::error!("Wake word detection error: {}", e);
                                    }
                                });
                                log::info!("Wake word detection enabled");
                            }
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            log::info!("Chief Desktop started");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            enable_wake_word,
            disable_wake_word,
            is_wake_word_enabled,
            show_window,
            hide_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
