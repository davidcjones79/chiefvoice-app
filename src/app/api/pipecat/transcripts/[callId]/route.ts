import { NextRequest, NextResponse } from "next/server";

// In-memory transcript store (indexed by callId)
// In production, this could be Redis or a database
const transcriptStore = new Map<string, Array<{
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  isFinal: boolean;
}>>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  
  if (!callId) {
    return NextResponse.json(
      { error: "callId is required" },
      { status: 400 }
    );
  }

  const transcripts = transcriptStore.get(callId) || [];
  
  // Get transcripts since last poll (using timestamp from query param)
  const url = new URL(request.url);
  const since = parseInt(url.searchParams.get("since") || "0");
  
  const newTranscripts = transcripts.filter(t => t.timestamp > since);
  
  return NextResponse.json({
    transcripts: newTranscripts,
    total: transcripts.length,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  // Backend bot posts transcripts here
  const { callId } = await params;
  
  if (!callId) {
    return NextResponse.json(
      { error: "callId is required" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { role, text, timestamp, isFinal } = body;

  if (!role || !text) {
    return NextResponse.json(
      { error: "role and text are required" },
      { status: 400 }
    );
  }

  const transcripts = transcriptStore.get(callId) || [];
  transcripts.push({
    role,
    text,
    timestamp: timestamp || Date.now(),
    isFinal: isFinal !== false,
  });
  
  transcriptStore.set(callId, transcripts);
  
  // Cleanup old transcripts (keep last 100)
  if (transcripts.length > 100) {
    transcriptStore.set(callId, transcripts.slice(-100));
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  // Cleanup transcripts for a call
  const { callId } = await params;
  
  if (!callId) {
    return NextResponse.json(
      { error: "callId is required" },
      { status: 400 }
    );
  }

  transcriptStore.delete(callId);
  
  return NextResponse.json({ success: true });
}
