import { NextRequest, NextResponse } from "next/server";
import { getCalls, createCall, addTranscript, endCall } from "@/lib/db/schema";

// GET /api/calls - List all calls
export async function GET() {
  try {
    const calls = getCalls(50);
    return NextResponse.json({ calls });
  } catch (error) {
    console.error("Failed to get calls:", error);
    return NextResponse.json(
      { error: "Failed to retrieve calls" },
      { status: 500 }
    );
  }
}

// POST /api/calls - Create a new call
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, startedAt, sessionKey } = body;

    if (!id || !startedAt) {
      return NextResponse.json(
        { error: "Missing required fields: id, startedAt" },
        { status: 400 }
      );
    }

    createCall(id, startedAt, sessionKey);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Failed to create call:", error);
    return NextResponse.json(
      { error: "Failed to create call" },
      { status: 500 }
    );
  }
}

// PATCH /api/calls - End a call or add transcript
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...data } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: "Missing required fields: id, action" },
        { status: 400 }
      );
    }

    switch (action) {
      case "end":
        if (!data.endedAt) {
          return NextResponse.json(
            { error: "Missing endedAt for end action" },
            { status: 400 }
          );
        }
        endCall(id, data.endedAt);
        break;

      case "transcript":
        if (!data.role || !data.text || !data.timestamp) {
          return NextResponse.json(
            { error: "Missing transcript fields: role, text, timestamp" },
            { status: 400 }
          );
        }
        addTranscript(id, data.role, data.text, data.timestamp);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update call:", error);
    return NextResponse.json(
      { error: "Failed to update call" },
      { status: 500 }
    );
  }
}
