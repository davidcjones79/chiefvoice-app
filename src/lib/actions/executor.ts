// Execute approved actions directly via CLI tools

import { exec } from 'child_process';
import { promisify } from 'util';
import { ActionPlan, Action } from './types';
import { sendExecutionReport } from './telegram';

const execAsync = promisify(exec);

// Default email account to use
const EMAIL_ACCOUNT = process.env.EMAIL_ACCOUNT || 'david@sonomait.com';

// Execute a shell command with timeout
async function runCommand(cmd: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string }> {
  console.log(`[Executor] Running: ${cmd}`);
  try {
    const result = await execAsync(cmd, { 
      timeout: timeoutMs,
      env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin' }
    });
    return result;
  } catch (error: any) {
    if (error.stdout || error.stderr) {
      return { stdout: error.stdout || '', stderr: error.stderr || error.message };
    }
    throw error;
  }
}

// Escape shell arguments
function escapeArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

// Execute a single action
async function executeAction(action: Action): Promise<{ success: boolean; result?: string; error?: string }> {
  const params = action.params as Record<string, string>;

  try {
    switch (action.type) {
      case 'send_email': {
        const to = params.to;
        const subject = params.subject || '';
        const body = params.body || '';
        
        if (!to) {
          return { success: false, error: 'Missing email recipient' };
        }

        const cmd = `gog gmail send --to ${escapeArg(to)} --subject ${escapeArg(subject)} --body ${escapeArg(body)} --account ${EMAIL_ACCOUNT}`;
        const result = await runCommand(cmd);
        
        if (result.stdout.includes('message_id')) {
          return { success: true, result: `Email sent to ${to}` };
        } else {
          return { success: false, error: result.stderr || 'Failed to send email' };
        }
      }

      case 'add_task': {
        const title = params.title || params.description || 'New task';
        const due = params.due || '';
        const project = params.project || '';
        
        // Use todoist CLI for task creation
        let taskStr = title;
        if (due) taskStr += ` ${due}`;
        if (project) taskStr += ` #${project}`;
        
        const cmd = `todoist quick ${escapeArg(taskStr)}`;
        const result = await runCommand(cmd);
        
        return { success: true, result: `Task added: ${title}` };
      }

      case 'set_reminder': {
        const message = params.message || 'Reminder';
        const time = params.time || '';
        
        // Use remindctl for Apple Reminders
        const cmd = `remindctl add ${escapeArg(message)}${time ? ` --due ${escapeArg(time)}` : ''}`;
        const result = await runCommand(cmd);
        
        return { success: true, result: `Reminder set: ${message}` };
      }

      case 'check_calendar': {
        const date = params.date || 'today';
        const cmd = `gog calendar list --from ${escapeArg(date)} --to ${escapeArg(date)} --account ${EMAIL_ACCOUNT}`;
        const result = await runCommand(cmd);
        
        return { success: true, result: result.stdout || 'No events found' };
      }

      case 'search_web': {
        const query = params.query || '';
        if (!query) {
          return { success: false, error: 'Missing search query' };
        }
        
        // This would typically return search results
        // For now, we log it - actual search would be done differently
        return { success: true, result: `Would search for: ${query}` };
      }

      case 'send_message': {
        const to = params.to || '';
        const message = params.message || params.body || '';
        const platform = params.platform || 'imessage';
        
        if (!to || !message) {
          return { success: false, error: 'Missing recipient or message' };
        }

        // Route to appropriate messaging tool
        let cmd: string;
        if (platform === 'imessage' || platform === 'sms') {
          cmd = `imsg send ${escapeArg(to)} ${escapeArg(message)}`;
        } else {
          return { success: false, error: `Unsupported messaging platform: ${platform}` };
        }
        
        const result = await runCommand(cmd);
        return { success: true, result: `Message sent to ${to}` };
      }

      case 'run_command': {
        const command = params.command || '';
        if (!command) {
          return { success: false, error: 'Missing command' };
        }
        
        // Safety check - only allow certain commands
        const allowedPrefixes = ['gog ', 'todoist ', 'gh ', 'curl '];
        const isAllowed = allowedPrefixes.some(prefix => command.startsWith(prefix));
        
        if (!isAllowed) {
          return { success: false, error: `Command not in allowlist: ${command.split(' ')[0]}` };
        }
        
        const result = await runCommand(command);
        return { success: true, result: result.stdout || 'Command executed' };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Executor] Action failed:`, error);
    return { success: false, error: errorMsg };
  }
}

// Execute all approved actions in a plan
export async function executePlan(plan: ActionPlan): Promise<ActionPlan> {
  console.log(`[Executor] Executing plan ${plan.callId} with ${plan.actions.length} actions`);

  const updatedActions: Action[] = [];

  for (const action of plan.actions) {
    if (action.status === 'approved' || action.privilegeLevel === 'safe') {
      console.log(`[Executor] Executing action: ${action.description}`);
      const result = await executeAction(action);
      
      console.log(`[Executor] Result:`, result);
      
      updatedActions.push({
        ...action,
        status: result.success ? 'executed' : 'failed',
        result: result.result,
        error: result.error,
      });
    } else if (action.status === 'rejected') {
      updatedActions.push({
        ...action,
        result: 'Skipped (rejected by user)',
      });
    } else {
      updatedActions.push(action);
    }
  }

  const updatedPlan: ActionPlan = {
    ...plan,
    actions: updatedActions,
    status: 'executed',
  };

  // Send execution report via Telegram
  await sendExecutionReport(updatedPlan);

  return updatedPlan;
}

// Approve specific actions in a plan
export function approveActions(plan: ActionPlan, actionIds: string[]): ActionPlan {
  return {
    ...plan,
    actions: plan.actions.map(action => ({
      ...action,
      status: actionIds.includes(action.id) ? 'approved' : action.status,
    })),
  };
}

// Approve all actions
export function approveAllActions(plan: ActionPlan): ActionPlan {
  return {
    ...plan,
    status: 'approved',
    actions: plan.actions.map(action => ({
      ...action,
      status: 'approved',
    })),
  };
}

// Reject all actions
export function rejectAllActions(plan: ActionPlan): ActionPlan {
  return {
    ...plan,
    status: 'rejected',
    actions: plan.actions.map(action => ({
      ...action,
      status: 'rejected',
    })),
  };
}
