// Rich card types for visual display alongside transcript

export type CardType = "calendar" | "tasks" | "weather" | "email" | "timer" | "info" | "actionitems" | "code" | "learning";

export interface BaseCard {
  type: CardType;
  id?: string;
}

export interface CalendarCard extends BaseCard {
  type: "calendar";
  events: Array<{
    title: string;
    time: string;
    location?: string;
    duration?: string;
  }>;
}

export interface TasksCard extends BaseCard {
  type: "tasks";
  title?: string;
  items: Array<{
    text: string;
    done?: boolean;
    due?: string;
    priority?: "high" | "medium" | "low";
  }>;
}

export interface WeatherCard extends BaseCard {
  type: "weather";
  location: string;
  current: {
    temp: number;
    condition: string;
    icon?: string;
  };
  forecast?: Array<{
    day: string;
    high: number;
    low: number;
    condition: string;
  }>;
}

export interface EmailCard extends BaseCard {
  type: "email";
  emails: Array<{
    from: string;
    subject: string;
    preview?: string;
    time?: string;
    unread?: boolean;
  }>;
}

export interface TimerCard extends BaseCard {
  type: "timer";
  label: string;
  targetTime?: string; // ISO timestamp
  duration?: number;   // seconds
  action?: "set" | "cancelled" | "fired";
}

export interface InfoCard extends BaseCard {
  type: "info";
  title?: string;
  content: string;
  icon?: string;
}

export interface ActionItemsCard extends BaseCard {
  type: "actionitems";
  title?: string;
  items: Array<{
    text: string;
    assignee?: string;
    due?: string;
    done?: boolean;
    priority?: "high" | "medium" | "low";
  }>;
}

export interface CodeCard extends BaseCard {
  type: "code";
  language?: string;
  title?: string;
  code: string;
  filename?: string;
}

export interface LearningCard extends BaseCard {
  type: "learning";
  concept?: string;
  keyPoints?: string[];
  followUp?: string[];
  summary?: string;
}

export type Card = CalendarCard | TasksCard | WeatherCard | EmailCard | TimerCard | InfoCard | ActionItemsCard | CodeCard | LearningCard;

// Parsed result from assistant message
export interface ParsedMessage {
  text: string;       // Clean text for display/speech
  cards: Card[];      // Extracted cards
}
