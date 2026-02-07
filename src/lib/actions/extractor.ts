// Extract action plan from conversation transcript

import { Action, ActionPlan, ActionType, generateActionId, getPrivilegeLevel } from './types';

const ACTION_EXTRACTION_PROMPT = `Analyze this voice conversation transcript and extract any actions the user requested.

Return a JSON object with:
{
  "summary": "Brief 1-sentence summary of what the user wanted",
  "actions": [
    {
      "type": "send_email|add_task|set_reminder|run_command|search_web|check_calendar|send_message|other",
      "description": "Human-readable description of the action",
      "params": { relevant parameters like "to", "subject", "body", "time", etc }
    }
  ]
}

If no actions were requested, return: {"summary": "General conversation", "actions": []}

Action type guidelines:
- send_email: User wants to send an email
- add_task: User wants to add a todo/task
- set_reminder: User wants a reminder at a specific time
- run_command: User wants to execute a system command
- send_message: User wants to send a text/Telegram/etc message
- check_calendar: User wants to check their schedule
- search_web: User wants to look something up
- other: Anything else that seems actionable

TRANSCRIPT:
`;

export async function extractActionsFromTranscript(
  callId: string,
  transcript: string,
  chiefvoiceGatewayUrl?: string,
  chiefvoiceToken?: string
): Promise<ActionPlan> {
  // For now, use a simple pattern-based extraction
  // TODO: Route through ChiefVoice for smarter extraction
  
  const actions: Action[] = [];
  const lowerTranscript = transcript.toLowerCase();
  
  // Pattern matching for common actions
  if (lowerTranscript.includes('send') && lowerTranscript.includes('email')) {
    const emailMatch = transcript.match(/email\s+(?:to\s+)?([^\s,]+(?:@[^\s,]+)?)/i);
    actions.push({
      id: generateActionId(),
      type: 'send_email',
      description: 'Send an email',
      privilegeLevel: getPrivilegeLevel('send_email'),
      params: { to: emailMatch?.[1] || 'unknown' },
      status: 'pending'
    });
  }
  
  if (lowerTranscript.includes('remind') || lowerTranscript.includes('reminder')) {
    const timeMatch = transcript.match(/(?:at|in|by)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d+\s*(?:minutes?|hours?|days?))/i);
    actions.push({
      id: generateActionId(),
      type: 'set_reminder',
      description: 'Set a reminder',
      privilegeLevel: getPrivilegeLevel('set_reminder'),
      params: { time: timeMatch?.[1] || 'unspecified' },
      status: 'pending'
    });
  }
  
  if (lowerTranscript.includes('add') && (lowerTranscript.includes('task') || lowerTranscript.includes('todo'))) {
    actions.push({
      id: generateActionId(),
      type: 'add_task',
      description: 'Add a task',
      privilegeLevel: getPrivilegeLevel('add_task'),
      params: {},
      status: 'pending'
    });
  }
  
  if (lowerTranscript.includes('check') && lowerTranscript.includes('calendar')) {
    actions.push({
      id: generateActionId(),
      type: 'check_calendar',
      description: 'Check calendar',
      privilegeLevel: getPrivilegeLevel('check_calendar'),
      params: {},
      status: 'pending'
    });
  }

  // Generate summary
  const summary = actions.length > 0 
    ? `${actions.length} action(s) identified: ${actions.map(a => a.type.replace('_', ' ')).join(', ')}`
    : 'General conversation - no actions identified';

  return {
    callId,
    timestamp: new Date().toISOString(),
    summary,
    actions,
    status: actions.some(a => a.privilegeLevel !== 'safe') ? 'pending_approval' : 'approved'
  };
}

// Smarter extraction using ChiefVoice (for future use)
export async function extractActionsWithAI(
  callId: string,
  transcript: string,
  gatewayUrl: string,
  token: string
): Promise<ActionPlan> {
  // TODO: Implement AI-powered extraction via ChiefVoice
  // This would send the transcript + prompt to ChiefVoice and parse the response
  return extractActionsFromTranscript(callId, transcript);
}
