# Chief Recent Fixes & Improvements

**Date:** February 5, 2025

## Overview

Summary of recent bug fixes and feature improvements to the Chief voice assistant application.

---

## Bug Fixes

### 1. Response Duplication Fix (Critical)

**Problem:** The bot was repeating responses twice when answering questions.

**Root Cause:** The Gateway WebSocket client was yielding response text twice:
1. First from streaming delta chunks as they arrived
2. Again from the final `chat` event (duplicate)

**Fix:** Removed the duplicate yield in `stream_message()` - now only streams deltas and uses final event as completion signal.

**File:** `backend/chief_bot.py` (lines 350-354)

---

### 2. Barge-in (Interruption) Support

**Problem:** Users couldn't interrupt the bot while it was speaking in hands-free mode.

**Fix:**
- Keep microphone active during bot speech (don't mute)
- Send `user-started-speaking` interrupt signal from client
- Backend queues `StartInterruptionFrame()` to stop TTS
- Echo detection (30% word overlap) filters bot's own speech while allowing genuine interruptions

**Files:**
- `src/lib/voice/pipecat-provider.ts`
- `backend/chief_bot.py`

---

### 3. Echo Prevention

**Problem:** Bot was hearing and responding to its own speech output.

**Fixes implemented:**
- Word overlap echo detection (`is_echo()` function)
- 1-second cooldown after bot finishes speaking
- Message deduplication (skip identical consecutive messages)
- During bot speech: block echo, allow different content (barge-in)

**File:** `backend/chief_bot.py`

---

## New Features

### 4. Visual "Received" Indicator

**Feature:** Green checkmark flash shows when user input is captured.

**Implementation:**
- New `received` status type added to CallStatus
- CheckIcon component with scale-in animation
- Shows "Got it" label with green background
- Displays for 800ms before transitioning to "thinking"

**Files:**
- `src/lib/voice/types.ts`
- `src/components/StatusIndicator.tsx`
- `src/components/CallStatus.tsx`

---

### 5. Farewell Detection & Auto-Disconnect

**Feature:** Automatically ends call when user says goodbye.

**Patterns detected:** bye, goodbye, see you, later, take care, good night, hang up, disconnect, end call, etc.

**Implementation:** `is_farewell()` function checks for exact matches, prefix/suffix patterns, and keyword presence.

**File:** `backend/chief_bot.py`

---

### 6. Delayed Acknowledgment Phrases

**Feature:** Filler phrases ("Let me check on that...") now wait 3 seconds before playing.

**Rationale:** Prevents unnecessary acknowledgments for quick responses; only speaks when response is actually delayed.

**File:** `backend/chief_bot.py`

---

### 7. Siri Shortcuts Integration

**Feature:** Hands-free activation via Siri.

**Implementation:**
- iOS deep link: `chief://start`
- Auto-enables hands-free mode
- Auto-starts call when app opens

**Files:**
- `src/app/page.tsx`
- `ios/App/App/Info.plist` (URL scheme + background modes)

---

### 8. Improved Noise Filtering

**Feature:** Better background noise rejection.

**Deepgram settings:**
- `filler_words: false` - filters "um", "uh", etc.
- `endpointing: 300` - 300ms silence before finalizing

**VAD settings:**
- `confidence: 0.7` - higher threshold
- `min_volume: 0.6` - ignore quiet sounds
- `stop_secs: 0.9` - allow natural pauses

**File:** `backend/chief_bot.py`

---

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `backend/chief_bot.py` | Echo detection, farewell handling, Gateway fix, noise filtering |
| `src/lib/voice/pipecat-provider.ts` | Barge-in, received status, mic handling |
| `src/lib/voice/types.ts` | Added "received" status type |
| `src/components/StatusIndicator.tsx` | CheckIcon, received config |
| `src/components/CallStatus.tsx` | Received status config |
| `src/app/page.tsx` | Siri Shortcuts deep link handling |
| `ios/App/App/Info.plist` | URL scheme, background modes |

---

## Testing Notes

- **Barge-in:** Speak while bot is talking - should interrupt
- **Farewell:** Say "goodbye" or "bye" - should disconnect
- **Received indicator:** Should flash green briefly after speaking
- **Noise filtering:** Test in noisy environment
- **Duplication:** Responses should no longer repeat

---

## Architecture Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   iOS App   │────▶│  Daily.co   │────▶│  Pipecat    │
│  (Capacitor)│     │  (WebRTC)   │     │  Backend    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐     ┌──────▼──────┐
                    │  Deepgram   │◀────│   Gateway   │
                    │    (STT)    │     │  (ChiefVoice) │
                    └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐     ┌──────▼──────┐
                    │  OpenAI     │◀────│   Claude    │
                    │   (TTS)     │     │   (LLM)     │
                    └─────────────┘     └─────────────┘
```
