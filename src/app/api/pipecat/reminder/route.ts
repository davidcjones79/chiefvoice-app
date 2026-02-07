import { NextRequest, NextResponse } from "next/server";

// In-memory store for reminders (will be lost on restart - could use Redis/DB for persistence)
interface Reminder {
  id: string;
  message: string;
  triggerAt: number; // Unix timestamp in ms
  createdAt: number;
  triggered: boolean;
}

const reminders = new Map<string, Reminder>();

// Check for due reminders every 30 seconds
let checkerStarted = false;

function startReminderChecker() {
  if (checkerStarted) return;
  checkerStarted = true;

  setInterval(async () => {
    const now = Date.now();

    for (const [id, reminder] of reminders.entries()) {
      if (!reminder.triggered && reminder.triggerAt <= now) {
        console.log(`[Reminder] Triggering reminder: ${id}`);
        reminder.triggered = true;

        // Trigger outbound call with the reminder
        try {
          const baseUrl = process.env.CHIEF_API_URL || "http://localhost:3001";
          await fetch(`${baseUrl}/api/pipecat/outbound`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: `Reminder: ${reminder.message}`,
              urgency: "medium",
              context: `This is a scheduled reminder that was set ${formatTimeAgo(reminder.createdAt)}. The reminder message is: "${reminder.message}"`,
              notifyTelegram: true,
            }),
          });
          console.log(`[Reminder] Outbound call triggered for: ${reminder.message}`);
        } catch (error) {
          console.error(`[Reminder] Failed to trigger outbound call:`, error);
          reminder.triggered = false; // Retry next interval
        }
      }
    }

    // Clean up old triggered reminders (older than 1 hour)
    const oneHourAgo = now - 60 * 60 * 1000;
    for (const [id, reminder] of reminders.entries()) {
      if (reminder.triggered && reminder.triggerAt < oneHourAgo) {
        reminders.delete(id);
      }
    }
  }, 30000); // Check every 30 seconds
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/**
 * POST /api/pipecat/reminder - Schedule a callback reminder
 *
 * Body:
 * - message: string - What to remind about
 * - delayMinutes?: number - Minutes from now (default way to specify time)
 * - triggerAt?: number - Unix timestamp in ms (alternative to delayMinutes)
 */
export async function POST(request: NextRequest) {
  // Start the checker if not already running
  startReminderChecker();

  try {
    const { message, delayMinutes, triggerAt: providedTriggerAt } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    let triggerAt: number;

    if (providedTriggerAt) {
      triggerAt = providedTriggerAt;
    } else if (delayMinutes) {
      triggerAt = Date.now() + delayMinutes * 60 * 1000;
    } else {
      return NextResponse.json(
        { error: "Either delayMinutes or triggerAt is required" },
        { status: 400 }
      );
    }

    const id = `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const reminder: Reminder = {
      id,
      message,
      triggerAt,
      createdAt: Date.now(),
      triggered: false,
    };

    reminders.set(id, reminder);

    const triggerDate = new Date(triggerAt);
    const delayMs = triggerAt - Date.now();
    const delayMins = Math.round(delayMs / 60000);

    console.log(`[Reminder] Scheduled: "${message}" in ${delayMins} minutes (at ${triggerDate.toLocaleTimeString()})`);

    return NextResponse.json({
      success: true,
      id,
      message,
      triggerAt,
      triggerAtFormatted: triggerDate.toLocaleString(),
      delayMinutes: delayMins,
    });

  } catch (error) {
    console.error("[Reminder] Error scheduling reminder:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pipecat/reminder - List pending reminders
 */
export async function GET() {
  const pending = Array.from(reminders.values())
    .filter(r => !r.triggered)
    .map(r => ({
      id: r.id,
      message: r.message,
      triggerAt: r.triggerAt,
      triggerAtFormatted: new Date(r.triggerAt).toLocaleString(),
      minutesUntil: Math.round((r.triggerAt - Date.now()) / 60000),
    }));

  return NextResponse.json({ reminders: pending });
}

/**
 * DELETE /api/pipecat/reminder - Cancel a reminder
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id parameter required" }, { status: 400 });
  }

  const reminder = reminders.get(id);
  if (!reminder) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  reminders.delete(id);
  console.log(`[Reminder] Cancelled: "${reminder.message}"`);

  return NextResponse.json({ success: true, cancelled: reminder.message });
}
