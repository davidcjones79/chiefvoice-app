/**
 * Integration definitions for the ChiefVoice marketplace.
 *
 * Each integration describes a service that can be configured via env vars
 * stored in .env.local. The bot reads these at startup.
 */

export interface IntegrationField {
  envVar: string;
  label: string;
  placeholder: string;
  secret: boolean; // mask in UI + never return full value from API
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  iconUrl?: string; // optional — falls back to first letter
  authType?: "oauth" | "api_key";
  oauthProvider?: string;
  capabilities: string[];
  fields: IntegrationField[];
  docsUrl?: string;
}

export type IntegrationCategory =
  | "gateway"
  | "voice"
  | "llm"
  | "crm"
  | "productivity"
  | "communication";

export const CATEGORY_META: Record<
  IntegrationCategory,
  { label: string; description: string }
> = {
  gateway: {
    label: "Gateway",
    description: "Connect to the ChiefVoice backend gateway",
  },
  voice: {
    label: "Voice & Speech",
    description: "Speech-to-text and text-to-speech providers",
  },
  llm: {
    label: "AI / LLM",
    description: "Large language model providers",
  },
  crm: {
    label: "CRM",
    description: "Customer relationship management tools",
  },
  productivity: {
    label: "Productivity",
    description: "Notes, tasks, calendars, and docs",
  },
  communication: {
    label: "Communication",
    description: "Messaging and email platforms",
  },
};

export const INTEGRATIONS: Integration[] = [
  // ── Gateway ──────────────────────────────────────────
  {
    id: "chiefvoice-gateway",
    name: "ChiefVoice Gateway",
    description:
      "Connect to the ChiefVoice backend to unlock all 43 agent tools.",
    category: "gateway",
    capabilities: [
      "Full agent tool suite",
      "Persistent memory",
      "Audit logging",
      "Multi-user sessions",
    ],
    fields: [
      {
        envVar: "CHIEFVOICE_ENABLED",
        label: "Enable Gateway",
        placeholder: "true",
        secret: false,
      },
      {
        envVar: "CHIEFVOICE_GATEWAY_URL",
        label: "Gateway URL",
        placeholder: "wss://your-server:18789",
        secret: false,
      },
      {
        envVar: "CHIEFVOICE_GATEWAY_TOKEN",
        label: "Gateway Token",
        placeholder: "your-gateway-token",
        secret: true,
      },
    ],
    docsUrl: "https://github.com/chiefvoice/gateway#readme",
  },

  // ── Voice & Speech ───────────────────────────────────
  {
    id: "deepgram",
    name: "Deepgram",
    description: "Real-time speech-to-text with high accuracy and low latency.",
    category: "voice",
    capabilities: [
      "Streaming STT",
      "Speaker diarization",
      "Keyword boosting",
    ],
    fields: [
      {
        envVar: "DEEPGRAM_API_KEY",
        label: "API Key",
        placeholder: "dg-xxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://developers.deepgram.com",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Premium voice synthesis with natural-sounding voices.",
    category: "voice",
    capabilities: [
      "High-quality TTS",
      "Voice cloning",
      "Multi-language support",
    ],
    fields: [
      {
        envVar: "ELEVENLABS_API_KEY",
        label: "API Key",
        placeholder: "el-xxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://elevenlabs.io/docs",
  },
  {
    id: "daily",
    name: "Daily.co",
    description: "Cloud WebRTC transport for multi-party voice sessions.",
    category: "voice",
    capabilities: [
      "Cloud WebRTC rooms",
      "Recording",
      "HIPAA-eligible transport",
    ],
    fields: [
      {
        envVar: "DAILY_API_KEY",
        label: "API Key",
        placeholder: "your-daily-api-key",
        secret: true,
      },
      {
        envVar: "DAILY_API_URL",
        label: "API URL",
        placeholder: "https://api.daily.co/v1",
        secret: false,
      },
    ],
    docsUrl: "https://docs.daily.co",
  },

  // ── AI / LLM ────────────────────────────────────────
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, Whisper, and TTS models from OpenAI.",
    category: "llm",
    capabilities: [
      "GPT-4o conversations",
      "Whisper STT",
      "OpenAI TTS voices",
      "Function calling",
    ],
    fields: [
      {
        envVar: "OPENAI_API_KEY",
        label: "API Key",
        placeholder: "sk-xxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models for thoughtful, nuanced conversations.",
    category: "llm",
    capabilities: [
      "Claude conversations",
      "Long-context analysis",
      "Tool use",
    ],
    fields: [
      {
        envVar: "ANTHROPIC_API_KEY",
        label: "API Key",
        placeholder: "sk-ant-xxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://docs.anthropic.com",
  },
  {
    id: "google-ai",
    name: "Google AI",
    description: "Gemini models for multimodal AI capabilities.",
    category: "llm",
    capabilities: [
      "Gemini conversations",
      "Multimodal input",
      "Grounding with Search",
    ],
    fields: [
      {
        envVar: "GOOGLE_API_KEY",
        label: "API Key",
        placeholder: "AIzaxxxxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://ai.google.dev/docs",
  },

  // ── CRM ──────────────────────────────────────────────
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Sales CRM with deal tracking, contacts, and pipeline views.",
    category: "crm",
    capabilities: [
      "Search contacts & deals",
      "Create & update deals",
      "Activity logging",
      "Pipeline analytics",
    ],
    fields: [
      {
        envVar: "PIPEDRIVE_API_TOKEN",
        label: "API Token",
        placeholder: "your-pipedrive-token",
        secret: true,
      },
      {
        envVar: "PIPEDRIVE_DOMAIN",
        label: "Company Domain",
        placeholder: "yourcompany.pipedrive.com",
        secret: false,
      },
    ],
    docsUrl: "https://developers.pipedrive.com",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "All-in-one CRM with contacts, deals, and marketing tools.",
    category: "crm",
    capabilities: [
      "Contact management",
      "Deal tracking",
      "Email tracking",
      "Meeting scheduling",
    ],
    fields: [
      {
        envVar: "HUBSPOT_ACCESS_TOKEN",
        label: "Access Token",
        placeholder: "pat-xxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://developers.hubspot.com",
  },

  // ── Productivity ─────────────────────────────────────
  {
    id: "notion",
    name: "Notion",
    description: "Connected workspace for notes, docs, and knowledge bases.",
    category: "productivity",
    capabilities: [
      "Search pages & databases",
      "Create pages",
      "Update properties",
      "Query databases",
    ],
    fields: [
      {
        envVar: "NOTION_API_KEY",
        label: "Integration Token",
        placeholder: "ntn_xxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://developers.notion.com",
  },
  {
    id: "google-workspace",
    name: "Google Workspace",
    description:
      "Gmail, Calendar, Drive, Contacts, and Tasks via Google OAuth.",
    category: "productivity",
    authType: "oauth",
    oauthProvider: "google",
    capabilities: [
      "Gmail search & send",
      "Calendar events",
      "Drive files",
      "Contacts",
      "Tasks",
    ],
    fields: [
      {
        envVar: "GOOGLE_CLIENT_ID",
        label: "OAuth Client ID",
        placeholder: "xxx.apps.googleusercontent.com",
        secret: false,
      },
      {
        envVar: "GOOGLE_CLIENT_SECRET",
        label: "OAuth Client Secret",
        placeholder: "GOCSPX-xxx",
        secret: true,
      },
    ],
    docsUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issue tracking and project management for teams.",
    category: "productivity",
    capabilities: [
      "Search issues",
      "Create issues",
      "Update status",
      "List projects",
    ],
    fields: [
      {
        envVar: "LINEAR_API_KEY",
        label: "API Key",
        placeholder: "lin_api_xxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://developers.linear.app",
  },

  // ── Communication ────────────────────────────────────
  {
    id: "slack",
    name: "Slack",
    description: "Send messages and search conversations in Slack workspaces.",
    category: "communication",
    capabilities: [
      "Send messages",
      "Search messages",
      "List channels",
      "Thread replies",
    ],
    fields: [
      {
        envVar: "SLACK_BOT_TOKEN",
        label: "Bot Token",
        placeholder: "xoxb-xxxxxxxxxxxx",
        secret: true,
      },
    ],
    docsUrl: "https://api.slack.com/docs",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Send and receive messages via Telegram bot.",
    category: "communication",
    capabilities: [
      "Send messages",
      "Receive commands",
      "Inline queries",
      "Media sharing",
    ],
    fields: [
      {
        envVar: "TELEGRAM_BOT_TOKEN",
        label: "Bot Token",
        placeholder: "123456:ABCdef...",
        secret: true,
      },
      {
        envVar: "TELEGRAM_CHAT_ID",
        label: "Default Chat ID",
        placeholder: "-100xxxxxxxxxx",
        secret: false,
      },
    ],
    docsUrl: "https://core.telegram.org/bots/api",
  },
  {
    id: "email-smtp",
    name: "Email (SMTP)",
    description: "Send emails via any SMTP provider.",
    category: "communication",
    capabilities: [
      "Send emails",
      "HTML formatting",
      "Attachments",
    ],
    fields: [
      {
        envVar: "SMTP_HOST",
        label: "SMTP Host",
        placeholder: "smtp.gmail.com",
        secret: false,
      },
      {
        envVar: "SMTP_PORT",
        label: "SMTP Port",
        placeholder: "587",
        secret: false,
      },
      {
        envVar: "SMTP_USER",
        label: "Username",
        placeholder: "you@example.com",
        secret: false,
      },
      {
        envVar: "SMTP_PASS",
        label: "Password",
        placeholder: "app-specific-password",
        secret: true,
      },
    ],
  },
];

/** All known env var names (used by the API to whitelist writes). */
export const KNOWN_ENV_VARS = new Set(
  INTEGRATIONS.flatMap((i) => i.fields.map((f) => f.envVar))
);

/** Map from envVar → field metadata for quick lookup. */
export const FIELD_BY_ENV_VAR = new Map(
  INTEGRATIONS.flatMap((i) => i.fields.map((f) => [f.envVar, f] as const))
);

/** Category ordering for display. */
export const CATEGORY_ORDER: IntegrationCategory[] = [
  "gateway",
  "voice",
  "llm",
  "crm",
  "productivity",
  "communication",
];
