import { NextResponse } from "next/server";
import { testGatewayConnection } from "@/lib/gateway/server-client";

const GATEWAY_URL = process.env.CHIEFVOICE_GATEWAY_URL || "ws://localhost:18789";
const CHIEFVOICE_ENABLED = process.env.CHIEFVOICE_ENABLED === "true";

export async function GET() {
  const health: {
    status: "ok" | "degraded" | "error";
    chiefvoice: {
      enabled: boolean;
      url: string;
      connected: boolean;
      authenticated: boolean;
      error?: string;
    };
    timestamp: string;
  } = {
    status: "ok",
    chiefvoice: {
      enabled: CHIEFVOICE_ENABLED,
      url: GATEWAY_URL,
      connected: false,
      authenticated: false,
    },
    timestamp: new Date().toISOString(),
  };

  // If ChiefVoice is enabled, check Gateway connectivity
  if (CHIEFVOICE_ENABLED) {
    try {
      const result = await testGatewayConnection();
      health.chiefvoice.connected = result.connected;
      health.chiefvoice.authenticated = result.authenticated;
      
      if (!result.connected) {
        health.status = "error";
        health.chiefvoice.error = result.error || "Gateway not reachable";
      } else if (!result.authenticated) {
        health.status = "degraded";
        health.chiefvoice.error = result.error || "Auth failed - check CHIEFVOICE_GATEWAY_TOKEN";
      } else if (result.error) {
        health.status = "degraded";
        health.chiefvoice.error = result.error;
      }
    } catch (error) {
      health.status = "error";
      health.chiefvoice.error =
        error instanceof Error ? error.message : "Connection failed";
    }
  }

  const statusCode =
    health.status === "ok" ? 200 : health.status === "degraded" ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
