// In-memory store for action plans — scoped by tenant_id
// TODO: Persist to Postgres for production

import { ActionPlan } from './types';

// Tenant-scoped plan storage: Map<tenantId, Map<callId, ActionPlan>>
const tenantPlans: Map<string, Map<string, ActionPlan>> = new Map();
const messageToCallId: Map<number, string> = new Map(); // Telegram message_id -> callId

function getPlansMap(tenantId: string = "default"): Map<string, ActionPlan> {
  if (!tenantPlans.has(tenantId)) {
    tenantPlans.set(tenantId, new Map());
  }
  return tenantPlans.get(tenantId)!;
}

export function savePlan(plan: ActionPlan, tenantId: string = "default"): void {
  getPlansMap(tenantId).set(plan.callId, plan);
  console.log(`[Store] Saved plan ${plan.callId} for tenant ${tenantId}`);
}

export function getPlan(callId: string, tenantId: string = "default"): ActionPlan | undefined {
  return getPlansMap(tenantId).get(callId);
}

export function updatePlan(callId: string, updates: Partial<ActionPlan>, tenantId: string = "default"): ActionPlan | undefined {
  const plans = getPlansMap(tenantId);
  const existing = plans.get(callId);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates };
  plans.set(callId, updated);
  console.log(`[Store] Updated plan ${callId} for tenant ${tenantId}`);
  return updated;
}

export function deletePlan(callId: string, tenantId: string = "default"): boolean {
  return getPlansMap(tenantId).delete(callId);
}

export function getAllPlans(tenantId: string = "default"): ActionPlan[] {
  return Array.from(getPlansMap(tenantId).values());
}

export function getPendingPlans(tenantId: string = "default"): ActionPlan[] {
  return Array.from(getPlansMap(tenantId).values()).filter(p => p.status === 'pending_approval');
}

// Alias for API compatibility
export const listPendingPlans = getPendingPlans;

export function getPlanByShortId(shortId: string, tenantId: string = "default"): ActionPlan | undefined {
  const normalized = shortId.toLowerCase();
  for (const [callId, plan] of getPlansMap(tenantId).entries()) {
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
