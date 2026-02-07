#!/usr/bin/env python3
"""
Chief Pipecat Backend - PHASE 1 REWRITE
Voice interface using Pipecat, Daily.co, Deepgram, OpenAI (built-in LLM)
ChiefVoice Gateway integration via event handlers (not in pipeline)
"""
import asyncio
import os
import sys
import json
import random
import time
import websockets
from dotenv import load_dotenv
from loguru import logger

# Immediate acknowledgment phrases (said right away when starting a task)
IMMEDIATE_PHRASES = [
    "Let me check on that.",
    "Looking into that now.",
    "On it.",
    "Let me see.",
    "Checking now.",
]

# Filler phrases for longer waits (said after initial delay)
FILLER_PHRASES = [
    "Still working on that...",
    "One moment...",
    "Just a sec...",
    "Give me a moment...",
    "Hang on...",
    "Almost there...",
    "Still on it...",
]

# Farewell patterns that should end the call
FAREWELL_PATTERNS = {
    "bye", "goodbye", "see you", "later", "take care", "night", "good night",
    "gotta go", "talk to you later", "catch you later", "i'm done", "end call",
    "hang up", "disconnect", "that's all", "thanks bye", "thank you bye",
}

def is_farewell(message: str) -> bool:
    """Check if a message is a farewell that should end the call."""
    msg = message.lower().strip().rstrip("!?.,:;")

    # Exact match
    if msg in FAREWELL_PATTERNS:
        return True

    # Starts or ends with farewell
    for pattern in FAREWELL_PATTERNS:
        if msg.startswith(pattern) or msg.endswith(pattern):
            return True

    # Contains farewell keywords (for phrases like "okay goodbye" or "goodbye rosie")
    farewell_keywords = {"bye", "goodbye", "goodnight", "later", "disconnect", "hang up", "end call"}
    words = set(msg.split())
    if words & farewell_keywords:  # Intersection - any match
        logger.info(f"🔍 Farewell keyword found in: '{msg}'")
        return True

    return False

# Simple chat patterns that don't need acknowledgment phrases
SIMPLE_CHAT_PATTERNS = {
    # Greetings
    "hi", "hello", "hey", "howdy", "hiya", "yo",
    "good morning", "good afternoon", "good evening", "good night",
    # Farewells
    "bye", "goodbye", "see you", "later", "take care", "night",
    # Thanks
    "thanks", "thank you", "appreciate it", "thx",
    # Affirmations
    "yes", "no", "yeah", "yep", "nope", "sure", "okay", "ok", "yup",
    "right", "correct", "got it", "understood", "alright", "fine",
    # Acknowledgments
    "cool", "nice", "great", "awesome", "perfect", "sounds good",
}

def is_simple_chat(message: str) -> bool:
    """Check if a message is simple conversational chat that doesn't need Gateway lookup."""
    msg = message.lower().strip().rstrip("!?.,:;")

    # Check exact matches
    if msg in SIMPLE_CHAT_PATTERNS:
        return True

    # Check if message starts with a simple pattern (e.g., "hello there")
    for pattern in SIMPLE_CHAT_PATTERNS:
        if msg.startswith(pattern + " ") or msg.startswith(pattern + ","):
            # But not if it's a question (e.g., "hey can you check...")
            if " can " in msg or " could " in msg or " would " in msg or "?" in message:
                return False
            return True

    # Very short messages (1-2 words) without question words are likely simple chat
    words = msg.split()
    if len(words) <= 2:
        question_words = {"what", "where", "when", "who", "why", "how", "which", "check", "find", "get", "show", "tell"}
        if not any(w in question_words for w in words) and "?" not in message:
            return True

    return False

def is_echo(user_message: str, recent_bot_responses: list, threshold: float = 0.6) -> bool:
    """
    Check if the user message is likely an echo of the bot's own speech.
    Returns True if the message appears to be echo (should be ignored).
    """
    if not recent_bot_responses:
        return False

    user_words = set(user_message.lower().split())
    if len(user_words) < 2:
        return False  # Too short to reliably detect echo

    for bot_response in recent_bot_responses:
        bot_words = set(bot_response.lower().split())
        if not bot_words:
            continue

        # Check word overlap - if user message shares many words with bot response
        common_words = user_words & bot_words
        # Ignore common filler words
        filler_words = {"the", "a", "an", "is", "are", "was", "were", "to", "and", "or", "i", "you", "it"}
        meaningful_common = common_words - filler_words
        meaningful_user = user_words - filler_words

        if len(meaningful_user) > 0:
            overlap_ratio = len(meaningful_common) / len(meaningful_user)
            if overlap_ratio >= threshold:
                logger.info(f"🔇 Echo detected! User: '{user_message[:50]}' overlaps {overlap_ratio:.0%} with bot response")
                return True

    return False

from pipecat.frames.frames import (
    EndFrame,
    LLMMessagesFrame,
    TTSSpeakFrame,
    StartInterruptionFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_response import (
    LLMAssistantResponseAggregator,
    LLMUserResponseAggregator,
)
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.piper.tts import PiperTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.daily.transport import DailyParams, DailyTransport
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from deepgram import LiveOptions

# Load environment variables from parent directory's .env.local
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
load_dotenv(env_path)

# Configuration
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_VOICE = os.getenv("OPENAI_VOICE", "shimmer")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "vu6gUGJTkGGUmQLLHG2D")
PIPER_VOICE = os.getenv("PIPER_VOICE", "en_US-lessac-medium")
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "openai")
CHIEFVOICE_GATEWAY_URL = os.getenv("CHIEFVOICE_GATEWAY_URL", "ws://localhost:18789")
CHIEFVOICE_GATEWAY_TOKEN = os.getenv("CHIEFVOICE_GATEWAY_TOKEN")
USE_GATEWAY = os.getenv("USE_GATEWAY", "false").lower() == "true"

# Outbound call configuration
OUTBOUND_MODE = os.getenv("OUTBOUND_MODE", "false").lower() == "true"
OUTBOUND_REASON = os.getenv("OUTBOUND_REASON", "")
OUTBOUND_URGENCY = os.getenv("OUTBOUND_URGENCY", "medium")
OUTBOUND_CONTEXT = os.getenv("OUTBOUND_CONTEXT", "")

# Configure logging
logger.remove(0)
logger.add(sys.stderr, level="INFO")  # Reduce noise for testing


class ChiefVoiceGatewayClient:
    """
    ChiefVoice Gateway client for sending messages via WebSocket.
    Used OUTSIDE the Pipecat pipeline to avoid StartFrame issues.
    """

    def __init__(self, gateway_url: str, token: str, call_id: str = None):
        self.gateway_url = gateway_url
        self.token = token
        self.call_id = call_id or f"pipecat-{int(asyncio.get_event_loop().time())}"
        self.session_key = f"agent:voice:chief-voice-{self.call_id}"
        self.ws = None
        self.connected = False
        self.request_counter = 0
        logger.info(f"Gateway client initialized: {self.gateway_url}")

    async def connect(self):
        """Connect to ChiefVoice Gateway using protocol v3"""
        if self.connected and self.ws:
            return

        logger.info(f"Connecting to ChiefVoice Gateway: {self.gateway_url}")

        try:
            self.ws = await websockets.connect(self.gateway_url)

            # Wait for connect.challenge event
            challenge_received = False
            while not challenge_received:
                message = await asyncio.wait_for(self.ws.recv(), timeout=10)
                frame = json.loads(message)

                if frame.get("type") == "event" and frame.get("event") == "connect.challenge":
                    logger.info("Received connect.challenge, sending auth")
                    challenge_received = True

                    # Send connect request with auth
                    connect_req = {
                        "type": "req",
                        "id": "connect-1",
                        "method": "connect",
                        "params": {
                            "minProtocol": 3,
                            "maxProtocol": 3,
                            "client": {
                                "id": "gateway-client",
                                "version": "0.1.0",
                                "platform": sys.platform,
                                "mode": "backend",
                            },
                            "auth": {
                                "token": self.token,
                            },
                        },
                    }
                    await self.ws.send(json.dumps(connect_req))

                    # Wait for connect response
                    response = await asyncio.wait_for(self.ws.recv(), timeout=10)
                    res_frame = json.loads(response)

                    if res_frame.get("type") == "res" and res_frame.get("id") == "connect-1":
                        if res_frame.get("ok"):
                            logger.info("✅ Successfully authenticated to ChiefVoice Gateway")
                            self.connected = True
                        else:
                            error = res_frame.get("error", {})
                            raise Exception(f"Authentication failed: {error.get('message', 'Unknown error')}")

        except Exception as e:
            logger.error(f"Failed to connect to gateway: {e}")
            raise

    async def send_message(self, message: str) -> str:
        """Send a message to ChiefVoice Gateway and get full response (non-streaming)"""
        full_text = ""
        async for chunk in self.stream_message(message):
            full_text += chunk
        return full_text

    async def stream_message(self, message: str):
        """Stream a message to ChiefVoice Gateway and yield text chunks as they arrive"""
        if not self.connected:
            await self.connect()

        self.request_counter += 1
        request_id = f"chat-{self.request_counter}"
        idempotency_key = f"voice-{int(asyncio.get_event_loop().time())}-{self.request_counter}"

        # Send chat.send request
        # Agent is selected via session key prefix: "agent:voice:..."
        chat_req = {
            "type": "req",
            "id": request_id,
            "method": "chat.send",
            "params": {
                "sessionKey": self.session_key,
                "message": message,
                "thinking": "off",
                "idempotencyKey": idempotency_key,
                "timeoutMs": 120000,
            },
        }

        logger.info(f"📤 Sending to Gateway: {message}")
        await self.ws.send(json.dumps(chat_req))

        # Wait for response and stream events
        run_id = None

        try:
            while True:
                msg = await asyncio.wait_for(self.ws.recv(), timeout=120)
                frame = json.loads(msg)

                # Debug: log all frames to understand what's coming back
                frame_type = frame.get("type")
                frame_event = frame.get("event")
                logger.info(f"📨 Gateway frame: type={frame_type} event={frame_event}")

                # Handle chat.send response (contains runId)
                if frame.get("type") == "res" and frame.get("id") == request_id:
                    if frame.get("ok"):
                        payload = frame.get("payload", {})
                        run_id = payload.get("runId")
                        logger.debug(f"Chat request accepted, runId: {run_id}")
                    else:
                        error = frame.get("error", {})
                        raise Exception(f"Chat request failed: {error.get('message', 'Unknown error')}")

                # Handle agent events (streaming response)
                if frame.get("type") == "event" and frame.get("event") == "agent":
                    payload = frame.get("payload", {})
                    logger.info(f"📨 Agent event FULL payload: {payload}")

                    # Only process events for our runId
                    if run_id and payload.get("runId") == run_id:
                        stream_type = payload.get("stream")
                        data = payload.get("data", {})

                        # Debug: log stream types to understand agent behavior
                        logger.info(f"📨 Agent stream: type={stream_type} data={data}")

                        # Stream assistant text - yield each chunk immediately
                        if stream_type == "assistant" and "delta" in data:
                            delta = data["delta"]
                            yield delta

                        # Note: lifecycle end just means agent run ended, but the response
                        # text comes in the chat event. Don't return here.
                        if stream_type == "lifecycle" and data.get("phase") == "end":
                            logger.info("📥 Agent lifecycle ended, waiting for chat response...")

                # Handle chat events (for errors or fallback completion)
                if frame.get("type") == "event" and frame.get("event") == "chat":
                    payload = frame.get("payload", {})
                    logger.info(f"📨 Chat event payload: {payload}")

                    if run_id and payload.get("runId") == run_id:
                        state = payload.get("state")

                        if state == "final":
                            # Response already streamed via delta chunks above
                            # Do NOT yield again here - that would duplicate the response
                            logger.info("📥 Gateway response complete (final)")
                            return
                        elif state in ["aborted", "error"]:
                            error_msg = payload.get("errorMessage", "Request failed")
                            raise Exception(f"Chat failed: {error_msg}")

        except asyncio.TimeoutError:
            logger.error("Timeout waiting for gateway response")
            raise Exception("Gateway timeout")

    async def close(self):
        """Close the WebSocket connection"""
        if self.ws:
            await self.ws.close()
            self.ws = None
            self.connected = False
            logger.info("Gateway connection closed")


async def post_transcript(call_id: str, role: str, text: str):
    """Post transcript to the Chief API"""
    try:
        import aiohttp
        api_url = os.getenv("CHIEF_API_URL", "http://localhost:3001")
        async with aiohttp.ClientSession() as session:
            await session.post(
                f"{api_url}/api/pipecat/transcripts/{call_id}",
                json={
                    "role": role,
                    "text": text,
                    "timestamp": int(asyncio.get_event_loop().time() * 1000),
                    "isFinal": True,
                }
            )
            logger.debug(f"📝 Posted transcript: [{role}] {text[:50]}")
    except Exception as e:
        logger.error(f"Failed to post transcript: {e}")


async def main():
    """Main entry point for Chief Pipecat Bot - PHASE 1 REWRITE"""
    logger.info("🎤 Starting Chief Pipecat Bot (Phase 1)...")
    
    # Get room URL and call ID from command line
    if len(sys.argv) < 2:
        logger.error("❌ Usage: python chief_bot.py <room_url> [call_id]")
        return
    
    room_url = sys.argv[1]
    call_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Validate configuration
    if not DEEPGRAM_API_KEY:
        logger.error("DEEPGRAM_API_KEY not set")
        return

    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY not set")
        return

    logger.info(f"Daily room: {room_url}")
    logger.info(f"Call ID: {call_id}")
    logger.info(f"TTS Provider: {TTS_PROVIDER}")
    if TTS_PROVIDER == "elevenlabs":
        logger.info(f"Voice: ElevenLabs {ELEVENLABS_VOICE_ID}")
    elif TTS_PROVIDER == "piper":
        logger.info(f"Voice: Piper {PIPER_VOICE} (local)")
    else:
        logger.info(f"Voice: OpenAI {OPENAI_VOICE}")
    logger.info(f"Gateway integration: {'ENABLED' if USE_GATEWAY else 'DISABLED'}")
    
    # Initialize services
    logger.info("Initializing Deepgram STT...")
    
    deepgram_options = LiveOptions(
        model="nova-2",
        language="en-US",
        smart_format=True,
        interim_results=True,
        punctuate=True,
        encoding="linear16",
        sample_rate=16000,
        channels=1,
        # Noise reduction
        filler_words=False,  # Filter out "um", "uh", etc.
        endpointing=300,     # Wait 300ms of silence before finalizing (reduces false triggers)
    )
    
    stt = DeepgramSTTService(
        api_key=DEEPGRAM_API_KEY,
        live_options=deepgram_options
    )
    
    logger.info("✅ Deepgram STT configured")
    
    # Initialize TTS (OpenAI, ElevenLabs, or Piper)
    if TTS_PROVIDER == "elevenlabs":
        if not ELEVENLABS_API_KEY:
            logger.error("ELEVENLABS_API_KEY not set")
            return
        logger.info(f"Initializing ElevenLabs TTS (voice: {ELEVENLABS_VOICE_ID})...")
        tts = ElevenLabsTTSService(
            api_key=ELEVENLABS_API_KEY,
            voice_id=ELEVENLABS_VOICE_ID,
            sample_rate=24000,
        )
        logger.info("✅ ElevenLabs TTS configured")
    elif TTS_PROVIDER == "piper":
        logger.info(f"Initializing Piper TTS (voice: {PIPER_VOICE})...")
        tts = PiperTTSService(
            voice_id=PIPER_VOICE,
            sample_rate=22050,  # Piper models output 22050Hz
        )
        # Workaround: pipecat doesn't auto-set sample_rate from model config
        tts._sample_rate = 22050
        logger.info("✅ Piper TTS configured (local inference, 22050Hz)")
    else:
        logger.info(f"Initializing OpenAI TTS (voice: {OPENAI_VOICE})...")
        tts = OpenAITTSService(
            api_key=OPENAI_API_KEY,
            voice=OPENAI_VOICE,
            sample_rate=24000,
            speed=1.15,  # Faster for snappier conversation
        )
        logger.info("✅ OpenAI TTS configured")
    
    # Initialize OpenAI LLM (built-in, no custom processor)
    logger.info("Initializing OpenAI LLM service...")
    llm = OpenAILLMService(
        api_key=OPENAI_API_KEY,
        model="gpt-4o",
    )
    logger.info("✅ OpenAI LLM configured")
    
    # Optional: Initialize Gateway client (outside pipeline)
    gateway_client = None
    if USE_GATEWAY and CHIEFVOICE_GATEWAY_TOKEN:
        logger.info("Initializing ChiefVoice Gateway client...")
        gateway_client = ChiefVoiceGatewayClient(
            gateway_url=CHIEFVOICE_GATEWAY_URL,
            token=CHIEFVOICE_GATEWAY_TOKEN,
            call_id=call_id
        )
        logger.info("✅ Gateway client configured (will intercept messages)")

    # Load TOOLS.md for integration context
    tools_context = ""
    tools_path = os.path.expanduser("~/clawd/TOOLS.md")
    if os.path.exists(tools_path):
        try:
            with open(tools_path, "r") as f:
                tools_context = f"\n\n## Available Tools & Integrations\n\n{f.read()}"
            logger.info(f"✅ Loaded TOOLS.md ({len(tools_context)} chars)")
        except Exception as e:
            logger.warning(f"Failed to load TOOLS.md: {e}")

    # Set up initial context for the LLM
    llm_messages = [
        {
            "role": "system",
            "content": f"""You are Rosie, Dave's AI assistant, speaking via Chief voice interface.
Keep responses concise since they will be spoken aloud, but you have FULL access to tools and integrations.

You CAN and SHOULD use tools when asked to:
- Check email (via gog command)
- Check calendar (via gog command)
- Create Notion pages (via mcporter/Notion MCP)
- Search the web
- Run shell commands
- Access all integrations listed below

When Dave asks you to do something like "check my email" or "what's on my calendar", USE THE TOOLS - don't say you can't access them.
{tools_context}"""
        }
    ]
    
    # Set up Daily transport
    logger.info("Setting up Daily transport...")
    
    # Configure VAD - balance between responsiveness and noise filtering
    vad_params = VADParams(
        confidence=0.7,     # Higher confidence to filter noise (default 0.7)
        start_secs=0.2,     # Require 200ms of speech before triggering (default 0.2)
        stop_secs=0.9,      # Allow natural pauses - don't interrupt mid-thought (default 0.8)
        min_volume=0.6,     # Higher volume threshold to filter background noise (default 0.6)
    )
    vad_analyzer = SileroVADAnalyzer(sample_rate=16000, params=vad_params)

    transport_params = DailyParams(
        audio_in_enabled=True,
        audio_in_sample_rate=16000,
        audio_out_enabled=True,
        audio_out_sample_rate=24000,
        camera_out_enabled=False,
        transcription_enabled=False,
        vad_enabled=True,
        vad_analyzer=vad_analyzer,
    )
    
    transport = DailyTransport(
        room_url=room_url,
        token=None,
        bot_name="Chief",
        params=transport_params
    )
    
    # Build the pipeline (OpenAI LLM only, no custom processors)
    logger.info("Building pipeline...")

    user_aggregator = LLMUserResponseAggregator(llm_messages)
    assistant_aggregator = LLMAssistantResponseAggregator(llm_messages)
    
    pipeline = Pipeline([
        transport.input(),
        stt,
        user_aggregator,
        llm,                    # Built-in OpenAI LLM (no StartFrame issues!)
        tts,
        transport.output(),
        assistant_aggregator
    ])
    
    # Create task
    task = PipelineTask(
        pipeline, 
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
            enable_usage_metrics=True,
        )
    )
    
    logger.info("✅ Pipeline ready!")
    
    # Optional: Intercept user messages for Gateway integration
    if gateway_client:
        logger.info("⚙️ Setting up Gateway message interceptor...")
        
        # Store original push_frame method
        original_push = user_aggregator.push_frame
        
        # Track recently used phrases to avoid repetition
        recent_immediate = []
        recent_fillers = []
        recent_bot_responses = []  # Track bot responses for echo detection
        last_bot_speech_end = 0.0  # Timestamp when bot last finished speaking
        bot_is_speaking = False  # Flag to track if bot is currently speaking
        last_processed_message = ""  # Deduplication: track last message to avoid processing twice
        processing_in_progress = False  # Prevent concurrent processing

        async def intercept_and_forward(frame, direction=None):
            """Intercept LLMMessagesFrame and forward to Gateway with streaming TTS"""
            nonlocal recent_immediate, recent_fillers, recent_bot_responses, last_bot_speech_end, bot_is_speaking
            nonlocal last_processed_message, processing_in_progress

            if isinstance(frame, LLMMessagesFrame):
                messages = frame.messages
                if messages and messages[-1].get("role") == "user":
                    user_message = messages[-1].get("content", "")

                    # Deduplication: Skip if same message as last processed
                    if user_message == last_processed_message:
                        logger.info(f"🔇 Ignoring duplicate message: '{user_message[:50]}...'")
                        return

                    # Prevent concurrent processing
                    if processing_in_progress:
                        logger.info(f"🔇 Ignoring message - already processing: '{user_message[:50]}...'")
                        return

                    # During bot speech, only process if it's clearly NOT echo
                    # (Allow barge-in with different content, block echo of bot's words)
                    if bot_is_speaking:
                        # Check if this looks like echo
                        if is_echo(user_message, recent_bot_responses, threshold=0.3):
                            logger.info(f"🔇 Ignoring echo while bot speaking: '{user_message[:50]}...'")
                            return
                        else:
                            logger.info(f"🎤 Barge-in detected (different content): '{user_message[:50]}...'")
                            # Cancel current bot speech by setting flag
                            bot_is_speaking = False

                    # Short cooldown: Ignore messages within 1 second after bot finishes
                    # (catches immediate echo, but allows quick follow-up from user)
                    time_since_bot = time.time() - last_bot_speech_end
                    if time_since_bot < 1.0:
                        logger.info(f"🔇 Ignoring message during cooldown: '{user_message[:50]}' ({time_since_bot:.1f}s after bot)")
                        return  # Skip - likely echo

                    # Check for echo (bot hearing itself)
                    if is_echo(user_message, recent_bot_responses, threshold=0.4):
                        logger.info(f"🔇 Ignoring echo: '{user_message[:50]}...'")
                        return  # Skip processing - it's echo

                    # Mark as processing
                    processing_in_progress = True
                    last_processed_message = user_message
                    stt_complete_time = time.time()
                    logger.info(f"🎤 User: {user_message}")
                    logger.info(f"⏱️ [PERF] STT complete at {stt_complete_time:.3f}")

                    # Post user transcript
                    try:
                        await post_transcript(call_id, "user", user_message)
                    except Exception as e:
                        logger.error(f"Failed to post user transcript: {e}")

                    # Check if this is simple chat (no acknowledgment needed)
                    simple_chat = is_simple_chat(user_message)

                    # Filler/acknowledgment state
                    first_chunk_received = asyncio.Event()
                    acknowledgment_sent = asyncio.Event()
                    ack_task = None
                    filler_task = None

                    async def send_acknowledgment_after_delay():
                        """Send acknowledgment if response takes more than 3 seconds"""
                        await asyncio.sleep(3)  # Wait 3 seconds before any filler
                        if not first_chunk_received.is_set() and not acknowledgment_sent.is_set():
                            acknowledgment_sent.set()
                            available_immediate = [p for p in IMMEDIATE_PHRASES if p not in recent_immediate]
                            if not available_immediate:
                                recent_immediate.clear()
                                available_immediate = IMMEDIATE_PHRASES
                            immediate = random.choice(available_immediate)
                            recent_immediate.append(immediate)
                            if len(recent_immediate) > 3:
                                recent_immediate.pop(0)
                            logger.info(f"💬 Acknowledgment after 3s: {immediate}")
                            await task.queue_frame(TTSSpeakFrame(text=immediate))

                    # Start acknowledgment timer for non-simple queries
                    if not simple_chat:
                        ack_task = asyncio.create_task(send_acknowledgment_after_delay())
                    else:
                        logger.info(f"💬 Simple chat detected, skipping acknowledgment")

                    # Streaming TTS with filler phrase support for longer waits

                    async def send_filler_after_delay():
                        """Send a filler phrase if response takes too long"""
                        nonlocal recent_fillers
                        await asyncio.sleep(4)  # Additional filler after 4 more seconds
                        if not first_chunk_received.is_set():
                            # Pick a filler that wasn't recently used
                            available = [f for f in FILLER_PHRASES if f not in recent_fillers]
                            if not available:
                                recent_fillers = []
                                available = FILLER_PHRASES
                            filler = random.choice(available)
                            recent_fillers.append(filler)
                            if len(recent_fillers) > 4:
                                recent_fillers.pop(0)

                            logger.info(f"⏳ Sending filler: {filler}")
                            await task.queue_frame(TTSSpeakFrame(text=filler))

                    try:
                        # Start filler task for longer waits (only for non-simple chat)
                        if not simple_chat:
                            filler_task = asyncio.create_task(send_filler_after_delay())

                        # Stream from Gateway and send chunks to TTS
                        full_response = ""
                        text_buffer = ""
                        chunks_sent = 0
                        gateway_send_time = time.time()
                        first_chunk_time = None
                        logger.info(f"⏱️ [PERF] Gateway request at {gateway_send_time:.3f} (STT→Gateway: {(gateway_send_time - stt_complete_time)*1000:.0f}ms)")

                        async for chunk in gateway_client.stream_message(user_message):
                            full_response += chunk
                            text_buffer += chunk

                            # Signal first chunk received (cancels filler)
                            if not first_chunk_received.is_set():
                                first_chunk_received.set()
                                bot_is_speaking = True  # Bot is now speaking
                                first_chunk_time = time.time()
                                ai_latency = first_chunk_time - gateway_send_time
                                e2e_latency = first_chunk_time - stt_complete_time
                                logger.info("🚀 First chunk received - streaming to TTS")
                                logger.info(f"⏱️ [PERF] First AI chunk at {first_chunk_time:.3f}")
                                logger.info(f"⏱️ [PERF] 🎯 AI Response Time: {ai_latency:.2f}s | End-to-End: {e2e_latency:.2f}s")

                            # Send to TTS when we have a complete sentence or enough text
                            # Look for sentence endings: . ! ? or newlines
                            # Also send if buffer gets long (for run-on sentences)
                            should_send = False
                            send_text = ""

                            # Check for sentence-ending punctuation
                            for i, char in enumerate(text_buffer):
                                if char in '.!?\n':
                                    # Include the punctuation and any following space
                                    end_idx = i + 1
                                    while end_idx < len(text_buffer) and text_buffer[end_idx] in ' \n':
                                        end_idx += 1
                                    send_text = text_buffer[:end_idx]
                                    text_buffer = text_buffer[end_idx:]
                                    should_send = True
                                    break

                            # Also send if buffer is getting long (150+ chars without punctuation)
                            if not should_send and len(text_buffer) > 150:
                                # Find a good break point (space)
                                break_point = text_buffer.rfind(' ', 0, 150)
                                if break_point > 50:
                                    send_text = text_buffer[:break_point + 1]
                                    text_buffer = text_buffer[break_point + 1:]
                                    should_send = True

                            if should_send and send_text.strip():
                                chunks_sent += 1
                                logger.info(f"📢 TTS chunk {chunks_sent}: {send_text[:50]}...")
                                await task.queue_frame(TTSSpeakFrame(text=send_text))

                        # Send any remaining text in buffer
                        if text_buffer.strip():
                            chunks_sent += 1
                            logger.info(f"📢 TTS final chunk {chunks_sent}: {text_buffer[:50]}...")
                            await task.queue_frame(TTSSpeakFrame(text=text_buffer))

                        stream_complete_time = time.time()
                        total_stream_time = stream_complete_time - gateway_send_time
                        logger.info(f"✅ Streaming complete: {chunks_sent} chunks, {len(full_response)} chars")
                        logger.info(f"⏱️ [PERF] Stream complete. Total generation: {total_stream_time:.2f}s")

                        # If Gateway returned empty, fall back to local LLM
                        if chunks_sent == 0 or not full_response.strip():
                            logger.warning("⚠️ Gateway returned empty response, falling back to OpenAI LLM")
                            # Don't return - let it fall through to the local LLM
                        else:
                            # Track bot response for echo detection
                            recent_bot_responses.append(full_response)
                            if len(recent_bot_responses) > 3:  # Keep last 3 responses
                                recent_bot_responses.pop(0)

                            # Set cooldown timer and mark bot as done speaking
                            # TTS will take ~2-4 more seconds to finish playing
                            estimated_tts_duration = len(full_response) / 15  # ~15 chars per second
                            last_bot_speech_end = time.time() + estimated_tts_duration
                            bot_is_speaking = False  # Allow new input after TTS queued
                            processing_in_progress = False  # Done processing
                            logger.info(f"🔊 TTS queued, estimated duration: {estimated_tts_duration:.1f}s")

                            # Post full transcript
                            try:
                                await post_transcript(call_id, "assistant", full_response)
                            except Exception as e:
                                logger.error(f"Failed to post assistant transcript: {e}")

                            # End call if user said farewell
                            if is_farewell(user_message):
                                logger.info("👋 Farewell detected - ending call after response")
                                # Wait for TTS to finish, then end
                                await asyncio.sleep(3.0)
                                await task.queue_frame(EndFrame())

                            # Don't pass to LLM - we already handled the response
                            return

                    except Exception as e:
                        logger.error(f"Gateway error: {e}")
                        first_chunk_received.set()  # Stop filler on error too
                        # Fall through to LLM on Gateway error
                    finally:
                        # Reset processing flag
                        processing_in_progress = False
                        bot_is_speaking = False
                        # Cancel acknowledgment task if still running
                        if ack_task and not ack_task.done():
                            ack_task.cancel()
                            try:
                                await ack_task
                            except asyncio.CancelledError:
                                pass
                        # Cancel filler task if still running
                        if filler_task and not filler_task.done():
                            filler_task.cancel()
                            try:
                                await filler_task
                            except asyncio.CancelledError:
                                pass

            # Call original push_frame (handle both signatures)
            if direction is not None:
                await original_push(frame, direction)
            else:
                await original_push(frame)
        
        # Replace push_frame with interceptor
        user_aggregator.push_frame = intercept_and_forward
        logger.info("✅ Gateway interceptor installed")
    
    # Run the bot
    runner = PipelineRunner()
    
    @transport.event_handler("on_joined")
    async def on_joined(transport_obj, data):
        logger.info(f"🎉 Bot joined! Room: {room_url}")
    
    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport_obj, participant):
        logger.info(f"👋 Participant joined: {participant.get('id')}")

        # Wait for transport to be ready
        await asyncio.sleep(1.5)

        # Different greeting for outbound (AI-initiated) calls
        if OUTBOUND_MODE:
            urgency_prefix = {
                "low": "Hey Dave,",
                "medium": "Hey Dave,",
                "high": "Dave,",
                "critical": "Dave, this is urgent."
            }.get(OUTBOUND_URGENCY, "Hey Dave,")

            greeting = f"{urgency_prefix} I'm calling because {OUTBOUND_REASON}."
            if OUTBOUND_CONTEXT:
                # Send context to Gateway so AI knows the full situation
                if gateway_client:
                    context_msg = f"[SYSTEM: This is an outbound call. Reason: {OUTBOUND_REASON}. Urgency: {OUTBOUND_URGENCY}. Context: {OUTBOUND_CONTEXT}. Explain the situation clearly and recommend actions.]"
                    try:
                        await gateway_client.connect()
                        # Pre-load context (don't wait for response)
                        asyncio.create_task(gateway_client.send_message(context_msg))
                    except Exception as e:
                        logger.error(f"Failed to send outbound context: {e}")
            logger.info(f"📞 Outbound call - Reason: {OUTBOUND_REASON}, Urgency: {OUTBOUND_URGENCY}")
        else:
            greeting = "Hey Dave! I'm here. What can I help you with?"

        logger.info(f"💬 Sending greeting: {greeting}")

        # Queue greeting through pipeline (correct method)
        try:
            await task.queue_frame(TTSSpeakFrame(text=greeting))
            logger.info("✅ Greeting queued")
            
            # Post transcript
            await post_transcript(call_id, "assistant", greeting)
        except Exception as e:
            logger.error(f"Failed to queue greeting: {e}", exc_info=True)
    
    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport_obj, participant, reason):
        logger.info(f"Participant left: {participant}, reason: {reason}")
        if gateway_client:
            # Ask agent to save memory before closing
            try:
                logger.info("📝 Requesting conversation memory save...")
                memory_prompt = (
                    "[SYSTEM: The voice call has ended. Please briefly summarize this conversation "
                    "(2-3 sentences max) and save anything important to memory/voice-sessions.md. "
                    "Include: date, key topics discussed, any action items or decisions made. "
                    "Do not respond with speech - just save to file silently.]"
                )
                await gateway_client.send_message(memory_prompt)
                logger.info("✅ Memory save requested")
            except Exception as e:
                logger.error(f"Failed to save memory: {e}")
            finally:
                await gateway_client.close()

    @transport.event_handler("on_app_message")
    async def on_app_message(transport_obj, message, sender):
        """Handle app messages from the client, including interrupt signals"""
        logger.info(f"📨 App message received: {message} from {sender}")

        # Check for interrupt signal (user-started-speaking from client)
        # Message structure: {'data': {'d': {}, 't': 'user-started-speaking'}, 'type': 'client-message', ...}
        msg_type = None
        if isinstance(message, dict):
            # Check nested structure first (RTVI client format)
            data = message.get("data", {})
            if isinstance(data, dict):
                msg_type = data.get("t")
            # Fall back to top-level type
            if not msg_type:
                msg_type = message.get("type") or message.get("label")
        elif isinstance(message, str):
            msg_type = message

        if msg_type == "user-started-speaking":
            logger.info("🛑 Interrupt signal received - stopping speech")
            try:
                await task.queue_frame(StartInterruptionFrame())
            except Exception as e:
                logger.error(f"Failed to queue interruption frame: {e}")

    try:
        logger.info("🚀 Starting bot...")
        await runner.run(task)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Bot error: {e}", exc_info=True)
    finally:
        if gateway_client:
            await gateway_client.close()
        await runner.cleanup()
    
    logger.info("🛑 Bot stopped.")


if __name__ == "__main__":
    asyncio.run(main())
