import type { VoiceProvider } from "./types";
import { getVapiProvider } from "./vapi-provider";
import { getPipecatProvider } from "./pipecat-provider";
import { getSmallWebRTCProvider } from "./smallwebrtc-provider";

export function getVoiceProvider(): VoiceProvider {
  const providerName = process.env.NEXT_PUBLIC_VOICE_PROVIDER ||
                       process.env.VOICE_PROVIDER ||
                       "pipecat"; // Default to Pipecat

  console.log(`[Provider Factory] Using voice provider: ${providerName}`);

  switch (providerName.toLowerCase()) {
    case "vapi":
      return getVapiProvider();
    case "pipecat":
      return getPipecatProvider();
    case "smallwebrtc":
      return getSmallWebRTCProvider();
    default:
      console.warn(`[Provider Factory] Unknown provider: ${providerName}, falling back to Pipecat`);
      return getPipecatProvider();
  }
}
