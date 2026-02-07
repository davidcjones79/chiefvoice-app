"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  isTauri,
  enableWakeWord,
  disableWakeWord,
  isWakeWordEnabled,
  onWakeWordDetected,
  onWakeWordTrainingNeeded,
} from '@/lib/tauri';

interface UseTauriReturn {
  /** Whether running in Tauri desktop app */
  isDesktopApp: boolean;
  /** Whether wake word detection is currently enabled */
  wakeWordEnabled: boolean;
  /** Whether wake word model needs training */
  needsTraining: boolean;
  /** Toggle wake word detection on/off */
  toggleWakeWord: () => Promise<void>;
  /** Enable wake word detection */
  enableWakeWord: () => Promise<void>;
  /** Disable wake word detection */
  disableWakeWord: () => Promise<void>;
}

/**
 * Hook for Tauri desktop app integration
 * Provides wake word detection controls and status
 */
export function useTauri(onWakeWord?: () => void): UseTauriReturn {
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [needsTraining, setNeedsTraining] = useState(false);

  // Check if running in Tauri on mount
  useEffect(() => {
    const inTauri = isTauri();
    setIsDesktopApp(inTauri);

    if (inTauri) {
      // Check initial wake word status
      isWakeWordEnabled().then(setWakeWordEnabled);

      // Listen for wake word detection
      let unlistenDetected: (() => void) | null = null;
      let unlistenTraining: (() => void) | null = null;

      onWakeWordDetected((wakeWord) => {
        console.log('[Tauri] Wake word detected:', wakeWord);
        onWakeWord?.();
      }).then((unlisten) => {
        unlistenDetected = unlisten;
      });

      onWakeWordTrainingNeeded(() => {
        console.log('[Tauri] Wake word training needed');
        setNeedsTraining(true);
      }).then((unlisten) => {
        unlistenTraining = unlisten;
      });

      return () => {
        unlistenDetected?.();
        unlistenTraining?.();
      };
    }
  }, [onWakeWord]);

  const handleEnableWakeWord = useCallback(async () => {
    try {
      await enableWakeWord();
      setWakeWordEnabled(true);
    } catch (error) {
      console.error('[Tauri] Failed to enable wake word:', error);
    }
  }, []);

  const handleDisableWakeWord = useCallback(async () => {
    try {
      await disableWakeWord();
      setWakeWordEnabled(false);
    } catch (error) {
      console.error('[Tauri] Failed to disable wake word:', error);
    }
  }, []);

  const toggleWakeWord = useCallback(async () => {
    if (wakeWordEnabled) {
      await handleDisableWakeWord();
    } else {
      await handleEnableWakeWord();
    }
  }, [wakeWordEnabled, handleEnableWakeWord, handleDisableWakeWord]);

  return {
    isDesktopApp,
    wakeWordEnabled,
    needsTraining,
    toggleWakeWord,
    enableWakeWord: handleEnableWakeWord,
    disableWakeWord: handleDisableWakeWord,
  };
}
