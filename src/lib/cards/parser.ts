import type { Card, ParsedMessage } from "./types";

/**
 * Card format in assistant responses:
 * 
 * [CARD:calendar]
 * {"events": [{"title": "Meeting with John", "time": "3:00 PM", "location": "Zoom"}]}
 * [/CARD]
 * 
 * Or single-line:
 * [CARD:tasks {"items": [{"text": "Buy groceries", "done": false}]}]
 */

// Pattern for multi-line cards
const MULTILINE_CARD_PATTERN = /\[CARD:(\w+)\]\s*([\s\S]*?)\s*\[\/CARD\]/gi;

// Pattern for single-line cards  
const INLINE_CARD_PATTERN = /\[CARD:(\w+)\s+(\{[\s\S]*?\})\]/gi;

/**
 * Parse assistant message and extract cards
 */
export function parseCards(text: string): ParsedMessage {
  const cards: Card[] = [];
  let cleanText = text;

  // Extract multi-line cards first
  cleanText = cleanText.replace(MULTILINE_CARD_PATTERN, (match, type, jsonStr) => {
    try {
      const data = JSON.parse(jsonStr.trim());
      cards.push({ type: type.toLowerCase(), ...data } as Card);
    } catch (e) {
      console.warn("[Cards] Failed to parse multi-line card:", e);
    }
    return ""; // Remove from text
  });

  // Extract inline cards
  cleanText = cleanText.replace(INLINE_CARD_PATTERN, (match, type, jsonStr) => {
    try {
      const data = JSON.parse(jsonStr);
      cards.push({ type: type.toLowerCase(), ...data } as Card);
    } catch (e) {
      console.warn("[Cards] Failed to parse inline card:", e);
    }
    return ""; // Remove from text
  });

  // Clean up extra whitespace
  cleanText = cleanText
    .replace(/\n{3,}/g, "\n\n")  // Max 2 newlines
    .replace(/^\s+|\s+$/g, "");   // Trim

  return { text: cleanText, cards };
}

/**
 * Strip cards from text (for TTS - we don't want to speak the JSON)
 */
export function stripCards(text: string): string {
  return parseCards(text).text;
}

/**
 * Check if text contains any cards
 */
export function hasCards(text: string): boolean {
  return MULTILINE_CARD_PATTERN.test(text) || INLINE_CARD_PATTERN.test(text);
}
