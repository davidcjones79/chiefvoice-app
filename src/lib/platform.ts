/**
 * Platform Detection Utilities
 *
 * Detects whether we're running in Capacitor (iOS), Electron (Desktop), Tauri (Desktop), or Web
 */

// Check if running in Electron
export const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'electronAPI' in window && (window as any).electronAPI?.isElectron === true;
};

// Check if running in Tauri
export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  return '__TAURI__' in window;
};

// Check if running in Capacitor
export const isCapacitor = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Capacitor adds this to the window object
  return 'Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.();
};

// Check if running as a native app (Capacitor, Electron, or Tauri)
export const isNativeApp = (): boolean => {
  return isElectron() || isTauri() || isCapacitor();
};

// Check if running as a desktop app (Electron or Tauri)
export const isDesktopApp = (): boolean => {
  return isElectron() || isTauri();
};

// Check if running in a web browser (not native)
export const isWebBrowser = (): boolean => {
  return !isNativeApp();
};

// Get current platform
export type Platform = 'ios' | 'electron' | 'tauri' | 'web';
export const getPlatform = (): Platform => {
  if (isElectron()) return 'electron';
  if (isTauri()) return 'tauri';
  if (isCapacitor()) return 'ios';
  return 'web';
};
