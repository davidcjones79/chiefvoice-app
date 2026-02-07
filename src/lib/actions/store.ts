// In-memory store for action plans (prototype)
// TODO: Persist to SQLite for production

import { ActionPlan } from './types';

const plans: Map<string, ActionPlan> = new Map();
const messageToCallId: Map<number, string> = new Map(); // Telegram message_id -> callId

export function savePlan(plan: ActionPlan): void {
  plans.set(plan.callId, plan);
  console.log(`[Store] Saved plan ${plan.callId}`);
}

export function getPlan(callId: string): ActionPlan | undefined {
  return plans.get(callId);
}

export function updatePlan(callId: string, updates: Partial<ActionPlan>): ActionPlan | undefined {
  const existing = plans.get(callId);
  if (!existing) return undefined;
  
  const updated = { ...existing, ...updates };
  plans.set(callId, updated);
  console.log(`[Store] Updated plan ${callId}`);
  return updated;
}

export function deletePlan(callId: string): boolean {
  return plans.delete(callId);
}

export function getAllPlans(): ActionPlan[] {
  return Array.from(plans.values());
}

export function getPendingPlans(): ActionPlan[] {
  return Array.from(plans.values()).filter(p => p.status === 'pending_approval');
}

// Alias for API compatibility
export const listPendingPlans = getPendingPlans;

export function getPlanByShortId(shortId: string): ActionPlan | undefined {
  // Match last N characters of callId
  const normalized = shortId.toLowerCase();
  for (const [callId, plan] of plans.entries()) {
    if (callId.toLowerCase().endsWith(normalized)) {
      return plan;
    }
  }
  return undefined;
}

// Message ID mapping for emoji reactions
export function storeMessageMapping(messageId: number, callId: string): void {
  messageToCallId.set(messageId, callId);
  console.log(`[Store] Mapped message ${messageId} -> plan ${callId.slice(-6)}`);
}

export function getCallIdFromMessage(messageId: number): string | undefined {
  return messageToCallId.get(messageId);
}

export function deleteMessageMapping(messageId: number): void {
  messageToCallId.delete(messageId);
}
