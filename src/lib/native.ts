/**
 * Native Platform Utilities for Capacitor iOS
 *
 * Provides native features like haptic feedback, status bar control, etc.
 * Falls back gracefully on web and Tauri.
 */

import { isCapacitor, isTauri } from './platform';

// Lazy-loaded Capacitor modules (only imported when needed)
let capacitorModules: {
  Capacitor?: typeof import('@capacitor/core').Capacitor;
  registerPlugin?: typeof import('@capacitor/core').registerPlugin;
  Haptics?: typeof import('@capacitor/haptics').Haptics;
  ImpactStyle?: typeof import('@capacitor/haptics').ImpactStyle;
  NotificationType?: typeof import('@capacitor/haptics').NotificationType;
  StatusBar?: typeof import('@capacitor/status-bar').StatusBar;
  Style?: typeof import('@capacitor/status-bar').Style;
  App?: typeof import('@capacitor/app').App;
  Keyboard?: typeof import('@capacitor/keyboard').Keyboard;
  Network?: typeof import('@capacitor/network').Network;
  Theme?: { setDarkMode(options: { isDark: boolean }): Promise<void> };
} = {};

let capacitorLoaded = false;
let capacitorLoadPromise: Promise<boolean> | null = null;

// Lazy load all Capacitor modules
async function loadCapacitorModules(): Promise<boolean> {
  if (capacitorLoaded) return true;
  if (capacitorLoadPromise) return capacitorLoadPromise;

  // Don't try to load in Tauri or non-Capacitor environments
  if (!isCapacitor()) {
    capacitorLoaded = true;
    return false;
  }

  capacitorLoadPromise = (async () => {
    try {
      const [core, haptics, statusBar, app, keyboard, network] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/haptics'),
        import('@capacitor/status-bar'),
        import('@capacitor/app'),
        import('@capacitor/keyboard'),
        import('@capacitor/network'),
      ]);

      capacitorModules = {
        Capacitor: core.Capacitor,
        registerPlugin: core.registerPlugin,
        Haptics: haptics.Haptics,
        ImpactStyle: haptics.ImpactStyle,
        NotificationType: haptics.NotificationType,
        StatusBar: statusBar.StatusBar,
        Style: statusBar.Style,
        App: app.App,
        Keyboard: keyboard.Keyboard,
        Network: network.Network,
      };

      // Register custom theme plugin
      capacitorModules.Theme = core.registerPlugin<{ setDarkMode(options: { isDark: boolean }): Promise<void> }>('Theme');

      capacitorLoaded = true;
      return true;
    } catch (e) {
      console.warn('Failed to load Capacitor modules:', e);
      capacitorLoaded = true;
      return false;
    }
  })();

  return capacitorLoadPromise;
}

// Platform detection - safe for all environments
export const isNative = () => isCapacitor();
export const isIOS = () => {
  if (!isCapacitor()) return false;
  // Check via Capacitor if loaded, otherwise use UA detection
  if (capacitorModules.Capacitor) {
    return capacitorModules.Capacitor.getPlatform() === 'ios';
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};
export const isAndroid = () => {
  if (!isCapacitor()) return false;
  if (capacitorModules.Capacitor) {
    return capacitorModules.Capacitor.getPlatform() === 'android';
  }
  return /android/i.test(navigator.userAgent);
};
export const isWeb = () => !isCapacitor() && !isTauri();

/**
 * Haptic Feedback
 */
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isCapacitor()) return;

  try {
    await loadCapacitorModules();
    if (!capacitorModules.Haptics || !capacitorModules.ImpactStyle) return;

    const styleMap = {
      light: capacitorModules.ImpactStyle.Light,
      medium: capacitorModules.ImpactStyle.Medium,
      heavy: capacitorModules.ImpactStyle.Heavy,
    };
    await capacitorModules.Haptics.impact({ style: styleMap[style] });
  } catch (e) {
    console.warn('Haptic feedback not available:', e);
  }
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!isCapacitor()) return;

  try {
    await loadCapacitorModules();
    if (!capacitorModules.Haptics || !capacitorModules.NotificationType) return;

    const typeMap = {
      success: capacitorModules.NotificationType.Success,
      warning: capacitorModules.NotificationType.Warning,
      error: capacitorModules.NotificationType.Error,
    };
    await capacitorModules.Haptics.notification({ type: typeMap[type] });
  } catch (e) {
    console.warn('Haptic notification not available:', e);
  }
}

export async function hapticSelection() {
  if (!isCapacitor()) return;

  try {
    await loadCapacitorModules();
    if (!capacitorModules.Haptics) return;

    await capacitorModules.Haptics.selectionStart();
    await capacitorModules.Haptics.selectionEnd();
  } catch (e) {
    console.warn('Haptic selection not available:', e);
  }
}

/**
 * Status Bar Control
 */
export async function setStatusBarTheme(isDark: boolean) {
  if (!isCapacitor()) return;

  try {
    await loadCapacitorModules();
    if (!capacitorModules.StatusBar || !capacitorModules.Style) return;

    await capacitorModules.StatusBar.setStyle({
      style: isDark ? capacitorModules.Style.Dark : capacitorModules.Style.Light
    });

    // iOS doesn't support background color, but Android does
    if (isAndroid()) {
      await capacitorModules.StatusBar.setBackgroundColor({
        color: isDark ? '#1a1a1a' : '#faf7f2'
      });
    }
  } catch (e) {
    console.warn('Status bar control not available:', e);
  }
}

/**
 * Set native window background color for safe areas (iOS)
 * This updates the color behind the notch and home indicator
 */
export async function setNativeTheme(isDark: boolean) {
  console.log('[setNativeTheme] called with isDark:', isDark, 'isCapacitor:', isCapacitor(), 'isIOS:', isIOS());

  if (!isCapacitor()) {
    console.log('[setNativeTheme] Not Capacitor, skipping');
    return;
  }

  try {
    await loadCapacitorModules();

    // Update status bar style
    await setStatusBarTheme(isDark);
    console.log('[setNativeTheme] Status bar updated');

    // Update window background color (for safe areas on iOS)
    if (isIOS() && capacitorModules.Theme) {
      console.log('[setNativeTheme] Calling Theme.setDarkMode...');
      await capacitorModules.Theme.setDarkMode({ isDark });
      console.log('[setNativeTheme] Theme.setDarkMode completed');
    }
  } catch (e) {
    console.error('[setNativeTheme] Error:', e);
  }
}

export async function hideStatusBar() {
  if (!isCapacitor()) return;
  try {
    await loadCapacitorModules();
    if (!capacitorModules.StatusBar) return;
    await capacitorModules.StatusBar.hide();
  } catch (e) {
    console.warn('Could not hide status bar:', e);
  }
}

export async function showStatusBar() {
  if (!isCapacitor()) return;
  try {
    await loadCapacitorModules();
    if (!capacitorModules.StatusBar) return;
    await capacitorModules.StatusBar.show();
  } catch (e) {
    console.warn('Could not show status bar:', e);
  }
}

/**
 * Keyboard Handling
 */
export function setupKeyboardListeners(
  onShow?: (height: number) => void,
  onHide?: () => void
) {
  if (!isCapacitor()) return () => {};

  let cleanup: (() => void) | undefined;

  loadCapacitorModules().then(() => {
    if (!capacitorModules.Keyboard) return;

    const showListener = capacitorModules.Keyboard.addListener('keyboardWillShow', (info) => {
      onShow?.(info.keyboardHeight);
    });

    const hideListener = capacitorModules.Keyboard.addListener('keyboardWillHide', () => {
      onHide?.();
    });

    cleanup = () => {
      showListener.then(l => l.remove());
      hideListener.then(l => l.remove());
    };
  });

  return () => {
    cleanup?.();
  };
}

/**
 * App State Handling
 */
export function setupAppStateListeners(
  onForeground?: () => void,
  onBackground?: () => void
) {
  if (!isCapacitor()) return () => {};

  let cleanup: (() => void) | undefined;

  loadCapacitorModules().then(() => {
    if (!capacitorModules.App) return;

    const listener = capacitorModules.App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        onForeground?.();
      } else {
        onBackground?.();
      }
    });

    cleanup = () => {
      listener.then(l => l.remove());
    };
  });

  return () => {
    cleanup?.();
  };
}

/**
 * Network Status
 */
export async function getNetworkStatus() {
  if (!isCapacitor()) {
    // Web/Tauri fallback
    return {
      connected: navigator.onLine,
      connectionType: 'unknown' as const,
    };
  }

  try {
    await loadCapacitorModules();
    if (!capacitorModules.Network) {
      return {
        connected: navigator.onLine,
        connectionType: 'unknown' as const,
      };
    }

    const status = await capacitorModules.Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType, // 'wifi' | 'cellular' | 'none' | 'unknown'
    };
  } catch (e) {
    // Fallback for web
    return {
      connected: navigator.onLine,
      connectionType: 'unknown' as const,
    };
  }
}

export function setupNetworkListeners(
  onOnline?: () => void,
  onOffline?: () => void
) {
  if (!isCapacitor()) {
    // Web/Tauri fallback
    const handleOnline = () => onOnline?.();
    const handleOffline = () => onOffline?.();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  let cleanup: (() => void) | undefined;

  loadCapacitorModules().then(() => {
    if (!capacitorModules.Network) return;

    const listener = capacitorModules.Network.addListener('networkStatusChange', (status) => {
      if (status.connected) {
        onOnline?.();
      } else {
        onOffline?.();
      }
    });

    cleanup = () => {
      listener.then(l => l.remove());
    };
  });

  return () => {
    cleanup?.();
  };
}
