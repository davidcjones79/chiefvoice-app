/**
 * Activity Stream - broadcasts real-time activity updates to connected clients
 */

export type ActivityType = 
  | "thinking"
  | "tool_start"
  | "tool_end" 
  | "searching"
  | "reading"
  | "writing"
  | "processing"
  | "links"
  | "approval";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  message: string;
  detail?: string;
  timestamp: number;
}

type ActivityListener = (event: ActivityEvent) => void;

class ActivityStream {
  private listeners: Set<ActivityListener> = new Set();
  private currentActivity: ActivityEvent | null = null;

  subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    // Send current activity to new subscriber
    if (this.currentActivity) {
      listener(this.currentActivity);
    }
    return () => this.listeners.delete(listener);
  }

  emit(event: Omit<ActivityEvent, "id" | "timestamp">) {
    const fullEvent: ActivityEvent = {
      ...event,
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    this.currentActivity = fullEvent;
    this.listeners.forEach(listener => listener(fullEvent));
  }

  clear() {
    this.currentActivity = null;
    this.emit({ type: "thinking", message: "" });
  }

  getCurrentActivity(): ActivityEvent | null {
    return this.currentActivity;
  }
}

// Singleton instance
export const activityStream = new ActivityStream();

/**
 * Parse response text for activity indicators and emit events
 */
export function parseActivityFromText(text: string): void {
  const lowerText = text.toLowerCase();
  
  // Detect common patterns
  if (lowerText.includes("searching") || lowerText.includes("looking up")) {
    activityStream.emit({ type: "searching", message: "Searching...", detail: text });
  } else if (lowerText.includes("checking") || lowerText.includes("let me check")) {
    activityStream.emit({ type: "reading", message: "Checking...", detail: text });
  } else if (lowerText.includes("reading") || lowerText.includes("looking at")) {
    activityStream.emit({ type: "reading", message: "Reading...", detail: text });
  } else if (lowerText.includes("writing") || lowerText.includes("drafting")) {
    activityStream.emit({ type: "writing", message: "Writing...", detail: text });
  } else if (lowerText.includes("one moment") || lowerText.includes("just a sec")) {
    activityStream.emit({ type: "processing", message: "Working on it...", detail: text });
  }
}

/**
 * Activity indicators to show while processing
 */
export const THINKING_MESSAGES = [
  { message: "Thinking...", icon: "🧠" },
  { message: "Processing your request...", icon: "⚙️" },
  { message: "Working on it...", icon: "💭" },
  { message: "Almost there...", icon: "✨" },
];

export const TOOL_ICONS: Record<string, string> = {
  web_search: "🔍",
  web_fetch: "🌐", 
  read: "📖",
  write: "✏️",
  exec: "⚡",
  email: "📧",
  calendar: "📅",
  default: "🔧",
};
