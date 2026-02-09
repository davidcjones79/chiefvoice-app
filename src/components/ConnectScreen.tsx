"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface ConnectScreenProps {
  onConnect: (gatewayUrl: string, token?: string) => Promise<void>;
}

export function ConnectScreen({ onConnect }: ConnectScreenProps) {
  const [gatewayUrl, setGatewayUrl] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_GATEWAY_URL || ""
  );
  const [token, setToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      await onConnect(gatewayUrl, token || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo/Title */}
        <div className="text-center">
          <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Chief</h1>
          <p className="text-white/60 mt-2">Voice interface for ChiefVoice</p>
        </div>

        {/* Connection form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Gateway URL
            </label>
            <Input
              type="url"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="wss://your-server:18789"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Token (optional)
            </label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter token if required"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={handleConnect}
            disabled={isConnecting || !gatewayUrl}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect to ChiefVoice"
            )}
          </Button>
        </div>

        {/* Help text */}
        <p className="text-xs text-white/40 text-center">
          Make sure your ChiefVoice Gateway is running and accessible.
        </p>
      </div>
    </div>
  );
}
