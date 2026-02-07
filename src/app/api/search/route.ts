import { NextRequest, NextResponse } from "next/server";

const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { query, count = 5 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    if (!BRAVE_API_KEY) {
      return NextResponse.json(
        { error: "Brave API key not configured" },
        { status: 500 }
      );
    }

    const searchParams = new URLSearchParams({
      q: query,
      count: String(Math.min(count, 10)),
      text_decorations: "false",
      search_lang: "en",
    });

    const response = await fetch(`${BRAVE_SEARCH_URL}?${searchParams}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Brave search error:", response.status, errorText);
      return NextResponse.json(
        { error: `Search failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    const results: SearchResult[] = (data.web?.results || []).map(
      (result: { title: string; url: string; description: string }) => ({
        title: result.title,
        url: result.url,
        description: result.description,
      })
    );

    return NextResponse.json({
      query,
      results,
    } as SearchResponse);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

// GET endpoint for simple queries
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const count = searchParams.get("count") || "5";

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  // Reuse POST logic
  const fakeRequest = {
    json: async () => ({ query, count: parseInt(count) }),
  } as NextRequest;
  
  return POST(fakeRequest);
}
