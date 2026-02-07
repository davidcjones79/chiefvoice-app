import { NextRequest } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface VisionChatRequest {
  message: string;
  imageBase64: string; // Base64 encoded image data (with data URL prefix)
  mimeType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VisionChatRequest = await request.json();

    console.log("[Vision Chat] Received request:", {
      messageLength: body.message?.length,
      hasImage: !!body.imageBase64,
      imageSize: body.imageBase64?.length,
    });

    if (!body.imageBase64) {
      return Response.json({ error: "Image is required" }, { status: 400 });
    }

    if (!OPENAI_API_KEY) {
      return Response.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    // Extract base64 data from data URL if present
    let imageData = body.imageBase64;
    let detectedMimeType = body.mimeType || "image/jpeg";

    if (imageData.startsWith("data:")) {
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        detectedMimeType = matches[1];
        imageData = matches[2];
      }
    }

    // Build the message for GPT-4 Vision
    const userMessage = body.message?.trim() || "What's in this image? Describe it in detail.";

    console.log("[Vision Chat] Calling OpenAI GPT-4 Vision...");

    // Call OpenAI API with streaming
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // GPT-4 with vision
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that can analyze images. Provide clear, concise descriptions and answer questions about images accurately. Be conversational and friendly.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userMessage,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${detectedMimeType};base64,${imageData}`,
                  detail: "auto", // Let OpenAI decide the detail level
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error("[Vision Chat] OpenAI error:", error);
      return Response.json(
        { error: `OpenAI API error: ${openaiResponse.status}` },
        { status: openaiResponse.status }
      );
    }

    // Stream the response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let fullResponse = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim());

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  // Send completion
                  const finalChunk = {
                    type: "complete",
                    content: "",
                    fullResponse,
                    timestamp: Date.now(),
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    const deltaChunk = {
                      type: "delta",
                      content,
                      timestamp: Date.now(),
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(deltaChunk)}\n\n`));
                  }
                } catch {
                  // Skip unparseable chunks
                }
              }
            }
          }
        } catch (error) {
          console.error("[Vision Chat] Stream error:", error);
          const errorChunk = {
            type: "error",
            content: error instanceof Error ? error.message : "Stream failed",
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Vision Chat] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
