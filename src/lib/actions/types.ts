// Action Plan Types for Voice-to-Action Pipeline

export type ActionType = 
  | 'send_email'
  | 'add_task'
  | 'set_reminder'
  | 'run_command'
  | 'search_web'
  | 'check_calendar'
  | 'send_message'
  | 'other';

export type PrivilegeLevel = 'safe' | 'privileged' | 'dangerous';

export interface Action {
  id: string;
  type: ActionType;
  description: string;
  privilegeLevel: PrivilegeLevel;
  params: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  result?: string;
  error?: string;
}

export interface ActionPlan {
  callId: string;
  timestamp: string;
  summary: string;
  actions: Action[];
  status: 'pending_approval' | 'approved' | 'partially_approved' | 'rejected' | 'executed';
}

export interface CallEndPayload {
  call: {
    id: string;
    status: string;
    endedReason?: string;
    transcript?: string;
    summary?: string;
    messages?: Array<{
      role: string;
      content: string;
    }>;
  };
}

// Privileged actions that require Telegram confirmation
export const PRIVILEGED_ACTIONS: ActionType[] = [
  'send_email',
  'send_message', 
  'run_command',
];

// Helper to determine privilege level
export function getPrivilegeLevel(type: ActionType): PrivilegeLevel {
  if (['run_command'].includes(type)) return 'dangerous';
  if (PRIVILEGED_ACTIONS.includes(type)) return 'privileged';
  return 'safe';
}

// Generate unique action ID
export function generateActionId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
