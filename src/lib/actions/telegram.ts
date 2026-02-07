// Telegram notification service for action approval

import { ActionPlan, Action } from './types';
import { storeMessageMapping } from './store';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramMessage {
  chat_id?: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: {
    inline_keyboard: Array<Array<{
      text: string;
      callback_data: string;
    }>>;
  };
}

export async function sendTelegramMessage(message: TelegramMessage): Promise<{ success: boolean; messageId?: number }> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[Telegram] Missing bot token or chat ID');
    return { success: false };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...message,
        chat_id: TELEGRAM_CHAT_ID,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Telegram] API error:', error);
      return { success: false };
    }

    const data = await response.json();
    const messageId = data.result?.message_id;
    return { success: true, messageId };
  } catch (error) {
    console.error('[Telegram] Failed to send message:', error);
    return { success: false };
  }
}

function getActionEmoji(type: string): string {
  const emojis: Record<string, string> = {
    send_email: '📧',
    add_task: '✅',
    set_reminder: '⏰',
    run_command: '⚡',
    search_web: '🔍',
    check_calendar: '📅',
    send_message: '💬',
    other: '📋',
  };
  return emojis[type] || '📋';
}

function getPrivilegeEmoji(level: string): string {
  return level === 'dangerous' ? '🔴' : level === 'privileged' ? '🟡' : '🟢';
}

export async function sendApprovalRequest(plan: ActionPlan): Promise<boolean> {
  const privilegedActions = plan.actions.filter(a => a.privilegeLevel !== 'safe');
  const safeActions = plan.actions.filter(a => a.privilegeLevel === 'safe');

  // Use short call ID for easier reference
  const shortId = plan.callId.slice(-6);

  let text = `🎙️ *Voice Call Ended*\n\n`;
  text += `📋 *Summary:* ${escapeMarkdown(plan.summary)}\n`;
  text += `🆔 *Call ID:* \`${shortId}\`\n\n`;

  if (privilegedActions.length > 0) {
    text += `⚠️ *Actions Requiring Approval:*\n`;
    privilegedActions.forEach((action, i) => {
      const emoji = getActionEmoji(action.type);
      const privEmoji = getPrivilegeEmoji(action.privilegeLevel);
      text += `${i + 1}\\. ${emoji} ${privEmoji} ${escapeMarkdown(action.description)}\n`;
      if (action.params && Object.keys(action.params).length > 0) {
        text += `   _${escapeMarkdown(JSON.stringify(action.params))}_\n`;
      }
    });
    text += `\n`;
  }

  if (safeActions.length > 0) {
    text += `✅ *Auto\\-approved Actions:*\n`;
    safeActions.forEach((action, i) => {
      const emoji = getActionEmoji(action.type);
      text += `${i + 1}\\. ${emoji} ${escapeMarkdown(action.description)}\n`;
    });
    text += `\n`;
  }

  // Instructions for approval
  text += `👍 React to approve \\| 👎 React to reject\n`;
  text += `_Or tell Rosie: "approve/reject chief ${shortId}"_`;

  const result = await sendTelegramMessage({
    text,
    parse_mode: 'MarkdownV2',
  });
  
  // Store message mapping for emoji reaction handling
  if (result.success && result.messageId) {
    storeMessageMapping(result.messageId, plan.callId);
  }
  
  return result.success;
}

export async function sendExecutionReport(plan: ActionPlan): Promise<boolean> {
  const shortId = plan.callId.slice(-6);
  
  let text = `📊 *Execution Report*\n\n`;
  text += `Call ID: \`${shortId}\`\n\n`;

  for (const action of plan.actions) {
    const emoji = getActionEmoji(action.type);
    const statusEmoji = action.status === 'executed' ? '✅' : 
                        action.status === 'failed' ? '❌' : 
                        action.status === 'rejected' ? '🚫' : '⏳';
    
    text += `${emoji} ${statusEmoji} *${escapeMarkdown(action.description)}*\n`;
    if (action.result) {
      text += `   Result: ${escapeMarkdown(action.result)}\n`;
    }
    if (action.error) {
      text += `   Error: ${escapeMarkdown(action.error)}\n`;
    }
    text += `\n`;
  }

  const result = await sendTelegramMessage({
    text,
    parse_mode: 'MarkdownV2',
  });
  return result.success;
}

// Escape special characters for MarkdownV2
function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}
