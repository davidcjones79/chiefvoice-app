use tauri::{AppHandle, Emitter};

/// Start wake word detection
///
/// TODO: Implement using macOS native Speech Recognition API
/// For now, this is a placeholder that notifies the user to set up wake word
pub fn start_detection(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Wake word detection not yet implemented");
    log::info!("Future: Will use macOS Speech Recognition API for 'Hey Rosie' detection");

    // Notify frontend that wake word training/setup is needed
    let _ = app.emit("wake-word-not-available", "Wake word detection coming soon. Use the menu bar icon to open Chief.");

    // For now, just keep the thread alive until disabled
    while crate::is_detection_enabled() {
        std::thread::sleep(std::time::Duration::from_millis(1000));
    }

    Ok(())
}

// Future: Use macOS native Speech Recognition
//
// This will use the NSSpeechRecognizer or SFSpeechRecognizer APIs
// to detect the wake word "Hey Rosie" without any external dependencies
//
// Benefits:
// - No dependency conflicts
// - Uses system-provided ML models
// - Privacy-preserving (on-device)
// - Low battery impact
