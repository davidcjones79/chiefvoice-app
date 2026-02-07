import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/pipecat/outbound/join?outbound=...&room=...
 *
 * Smart redirect that:
 * - On iOS with app installed: Opens chief:// deep link
 * - Otherwise: Redirects to the web app
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const outboundId = searchParams.get('outbound');
  const roomUrl = searchParams.get('room');

  if (!outboundId || !roomUrl) {
    return NextResponse.json({ error: "Missing outbound or room parameter" }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  const deepLink = `chief://call?outbound=${outboundId}&room=${encodeURIComponent(roomUrl)}`;
  const webUrl = `${process.env.CHIEF_PUBLIC_URL || 'http://localhost:3001'}?outbound=${outboundId}&room=${encodeURIComponent(roomUrl)}`;

  // For iOS, return an HTML page that tries the deep link first, then falls back to web
  if (isIOS) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Opening Chief...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a1a;
      color: white;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #c75b3a;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { margin-top: 20px; opacity: 0.7; }
    a { color: #c75b3a; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Opening Chief...</p>
  <a href="${webUrl}" id="fallback" style="display:none">Open in browser instead</a>
  <script>
    // Try to open the app
    window.location.href = "${deepLink}";

    // Show fallback link after a delay (app didn't open)
    setTimeout(function() {
      document.getElementById('fallback').style.display = 'block';
    }, 2500);

    // Auto-redirect to web after longer delay
    setTimeout(function() {
      window.location.href = "${webUrl}";
    }, 4000);
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // For non-iOS, just redirect to web
  return NextResponse.redirect(webUrl);
}
