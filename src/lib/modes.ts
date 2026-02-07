/**
 * Conversation mode definitions for Chief.
 * These prompts modify the agent's response style.
 */

export type ConversationMode = 'casual' | 'professional' | 'technical' | 'quick' | 'meeting' | 'coding' | 'learning' | 'search' | 'custom';

export type ResponseFormat = 'default' | 'concise' | 'detailed';

export const RESPONSE_FORMAT_PROMPTS: Record<ResponseFormat, string> = {
  default: '',
  concise: 'Keep responses brief and to the point. No unnecessary elaboration.',
  detailed: 'Provide detailed explanations with examples and thorough analysis.',
};

export const MODE_PROMPTS: Record<ConversationMode, string> = {
  casual: "Respond conversationally and naturally. Be warm, helpful, and use casual language. Provide thorough, complete answers that fully address the question. Don't be overly brief - take the time to explain things clearly and include relevant details.",
  professional: "Use formal, business-appropriate language. Be polite, structured, and professional.",
  technical: "Provide detailed technical explanations with specifics, code examples when relevant, and thorough analysis.",
  quick: "Give brief, concise answers only. Be direct and to-the-point without extra explanation.",
  meeting: `You are in meeting mode. Help track and organize meeting discussions.

When the user mentions action items, tasks, decisions, or follow-ups, emit an action items card:
[CARD:actionitems]
{"title": "Action Items", "items": [{"text": "Task description", "assignee": "Person", "due": "When"}]}
[/CARD]

At the end of a meeting or when asked to summarize, emit both a summary and action items:
[CARD:info]
{"title": "Meeting Summary", "icon": "📋", "content": "Brief summary of key discussion points..."}
[/CARD]

Extract action items naturally from conversation. Listen for phrases like "I'll do...", "Can you...", "We need to...", "Let's...", "Action item:", "TODO:", etc.`,
  
  coding: `You are in coding mode. Focus on code and technical implementation.

When providing code, use markdown code blocks with language specification:
\`\`\`javascript
// Your code here
\`\`\`

For important code snippets or examples, you can emit a code card for better display:
[CARD:code]
{"language": "javascript", "title": "Example Function", "code": "function hello() {\\n  return 'world';\\n}"}
[/CARD]

Provide syntax-highlighted, well-formatted code examples. Explain code step by step when helpful. Use inline \`code\` for variable names, functions, and short snippets.`,

  learning: `You are in learning mode. Focus on clear, educational explanations.

Break down complex topics into digestible steps:
1. Start with a simple explanation
2. Add details progressively  
3. Use analogies when helpful
4. Summarize key points

After explaining a concept, suggest follow-up questions to deepen understanding:
[CARD:learning]
{"concept": "Topic being discussed", "keyPoints": ["Point 1", "Point 2"], "followUp": ["What about X?", "How does Y work?", "Can you explain Z?"]}
[/CARD]

Encourage questions and reinforce understanding. Use examples from everyday life to illustrate abstract concepts.`,

  search: `You are in search mode. You have access to real-time web search results.

When answering questions:
1. Use the search results provided to give accurate, up-to-date information
2. Cite sources when referencing specific information
3. Synthesize information from multiple sources when relevant
4. If the search results don't answer the question, say so and provide what you can

Format citations naturally in your response, like "According to [Source]..." or include URLs for reference.

Be helpful and informative while being clear about what comes from search results vs. your general knowledge.`,

  custom: '' // Placeholder - actual prompt comes from custom prompt storage
};

export const MODE_CONFIG: Record<ConversationMode, { label: string; emoji: string; description: string }> = {
  casual: {
    label: 'Casual',
    emoji: '💬',
    description: 'Conversational and natural'
  },
  professional: {
    label: 'Professional',
    emoji: '👔',
    description: 'Formal, business-appropriate'
  },
  technical: {
    label: 'Technical',
    emoji: '🔧',
    description: 'Detailed technical explanations'
  },
  quick: {
    label: 'Quick',
    emoji: '⚡',
    description: 'Brief, concise answers'
  },
  meeting: {
    label: 'Meeting',
    emoji: '📋',
    description: 'Track action items & summaries'
  },
  coding: {
    label: 'Coding',
    emoji: '💻',
    description: 'Syntax highlighting & code focus'
  },
  learning: {
    label: 'Learning',
    emoji: '📚',
    description: 'Step-by-step explanations'
  },
  search: {
    label: 'Search',
    emoji: '🔍',
    description: 'Web search for real-time info'
  },
  custom: {
    label: 'Custom',
    emoji: '✨',
    description: 'Your custom mode'
  }
};

export const DEFAULT_MODE: ConversationMode = 'casual';

/**
 * Build a mode context string to prepend to messages.
 */
export function getModeContext(mode: ConversationMode): string {
  return `Mode: ${mode} - ${MODE_PROMPTS[mode]}`;
}

/**
 * Get mode prompt with optional custom prompt and response format.
 */
export function getFullModePrompt(
  mode: ConversationMode,
  customPrompt?: string,
  responseFormat?: ResponseFormat
): string {
  // Use custom prompt if mode is custom and customPrompt is provided
  const basePrompt = mode === 'custom' && customPrompt 
    ? customPrompt 
    : MODE_PROMPTS[mode];
  
  // Append response format if not default
  const formatPrompt = responseFormat && responseFormat !== 'default'
    ? RESPONSE_FORMAT_PROMPTS[responseFormat]
    : '';
  
  return formatPrompt ? `${basePrompt}\n\n${formatPrompt}` : basePrompt;
}

/**
 * Voice command patterns for mode switching.
 * Returns the detected mode or null if no match.
 */
const MODE_COMMAND_PATTERNS: Array<{ pattern: RegExp; mode: ConversationMode }> = [
  // "switch to X mode" / "switch to X"
  { pattern: /\b(?:switch|change|go)\s+(?:to|back\s+to)\s+(\w+)(?:\s+mode)?\b/i, mode: 'casual' },
  // "use X mode" / "enable X mode"
  { pattern: /\b(?:use|enable|activate)\s+(\w+)(?:\s+mode)?\b/i, mode: 'casual' },
  // "X mode please" / "X mode"
  { pattern: /\b(\w+)\s+mode(?:\s+please)?\b/i, mode: 'casual' },
];

// Mode name aliases
const MODE_ALIASES: Record<string, ConversationMode> = {
  // Standard modes
  casual: 'casual',
  professional: 'professional',
  technical: 'technical',
  quick: 'quick',
  meeting: 'meeting',
  coding: 'coding',
  learning: 'learning',
  search: 'search',
  custom: 'custom',
  // Aliases
  chill: 'casual',
  relaxed: 'casual',
  normal: 'casual',
  default: 'casual',
  formal: 'professional',
  business: 'professional',
  work: 'professional',
  tech: 'technical',
  detailed: 'technical',
  fast: 'quick',
  brief: 'quick',
  short: 'quick',
  concise: 'quick',
  code: 'coding',
  programming: 'coding',
  developer: 'coding',
  dev: 'coding',
  teach: 'learning',
  educational: 'learning',
  study: 'learning',
  tutor: 'learning',
  web: 'search',
  research: 'search',
  lookup: 'search',
  google: 'search',
  browse: 'search',
};

export interface VoiceCommandResult {
  isCommand: boolean;
  mode?: ConversationMode;
  confirmationMessage?: string;
}

/**
 * Detect if a message is a voice command to switch modes.
 * Returns the detected mode and a confirmation message if matched.
 */
export function detectModeCommand(message: string): VoiceCommandResult {
  const normalizedMessage = message.toLowerCase().trim();
  
  // Try each pattern
  for (const { pattern } of MODE_COMMAND_PATTERNS) {
    const match = normalizedMessage.match(pattern);
    if (match && match[1]) {
      const modeName = match[1].toLowerCase();
      const targetMode = MODE_ALIASES[modeName];
      
      if (targetMode) {
        const modeConfig = MODE_CONFIG[targetMode];
        return {
          isCommand: true,
          mode: targetMode,
          confirmationMessage: `${modeConfig.emoji} Switched to ${modeConfig.label} mode. ${modeConfig.description}.`
        };
      }
    }
  }
  
  return { isCommand: false };
}
