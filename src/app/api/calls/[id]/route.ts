import { NextRequest, NextResponse } from "next/server";
import { getCall, getTranscripts, deleteCall } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/calls/[id] - Get a single call with transcripts
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const call = getCall(id);

    if (!call) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    const transcripts = getTranscripts(id);

    return NextResponse.json({
      call,
      transcripts,
    });
  } catch (error) {
    console.error("Failed to get call:", error);
    return NextResponse.json(
      { error: "Failed to retrieve call" },
      { status: 500 }
    );
  }
}

// DELETE /api/calls/[id] - Delete a call
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    deleteCall(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete call:", error);
    return NextResponse.json(
      { error: "Failed to delete call" },
      { status: 500 }
    );
  }
}
