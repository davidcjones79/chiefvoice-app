/**
 * Tauri Desktop Integration
 * Provides wake word detection and native app features
 */

// Check if running in Tauri
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Tauri API types
interface TauriInvoke {
  (cmd: string, args?: Record<string, unknown>): Promise<unknown>;
}

interface TauriEvent {
  listen: (event: string, callback: (payload: { payload: unknown }) => void) => Promise<() => void>;
}

// Get Tauri APIs
const getTauriInvoke = (): TauriInvoke | null => {
  if (!isTauri()) return null;
  // @ts-expect-error - Tauri injects this
  return window.__TAURI__?.core?.invoke;
};

const getTauriEvent = (): TauriEvent | null => {
  if (!isTauri()) return null;
  // @ts-expect-error - Tauri injects this
  return window.__TAURI__?.event;
};

/**
 * Enable wake word detection
 */
export const enableWakeWord = async (): Promise<string> => {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error('Not running in Tauri');
  return invoke('enable_wake_word') as Promise<string>;
};

/**
 * Disable wake word detection
 */
export const disableWakeWord = async (): Promise<string> => {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error('Not running in Tauri');
  return invoke('disable_wake_word') as Promise<string>;
};

/**
 * Check if wake word detection is enabled
 */
export const isWakeWordEnabled = async (): Promise<boolean> => {
  const invoke = getTauriInvoke();
  if (!invoke) return false;
  return invoke('is_wake_word_enabled') as Promise<boolean>;
};

/**
 * Show the main window
 */
export const showWindow = async (): Promise<void> => {
  const invoke = getTauriInvoke();
  if (!invoke) return;
  await invoke('show_window');
};

/**
 * Hide the main window
 */
export const hideWindow = async (): Promise<void> => {
  const invoke = getTauriInvoke();
  if (!invoke) return;
  await invoke('hide_window');
};

/**
 * Listen for wake word detection events
 */
export const onWakeWordDetected = async (
  callback: (wakeWord: string) => void
): Promise<(() => void) | null> => {
  const event = getTauriEvent();
  if (!event) return null;

  const unlisten = await event.listen('wake-word-detected', (e) => {
    callback(e.payload as string);
  });

  return unlisten;
};

/**
 * Listen for wake word training needed events
 */
export const onWakeWordTrainingNeeded = async (
  callback: () => void
): Promise<(() => void) | null> => {
  const event = getTauriEvent();
  if (!event) return null;

  const unlisten = await event.listen('wake-word-training-needed', () => {
    callback();
  });

  return unlisten;
};
