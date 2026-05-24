// Minimal Tavily search client. Used by agents that need fresh web context
// (Company Researcher, People Finder).
//
// Tavily docs: https://docs.tavily.com/docs/rest-api/api-reference

import { env } from '../env.js';

export interface TavilySearchResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

interface TavilyRawResult {
  url?: unknown;
  title?: unknown;
  content?: unknown;
  score?: unknown;
}

interface TavilyResponse {
  results?: TavilyRawResult[];
}

function coerceResult(raw: TavilyRawResult): TavilySearchResult | null {
  const url = typeof raw.url === 'string' ? raw.url : null;
  if (!url) return null;
  return {
    url,
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    score: typeof raw.score === 'number' ? raw.score : 0,
  };
}

export async function tavilySearch(
  query: string,
  opts: { maxResults?: number } = {},
): Promise<TavilySearchResult[]> {
  const maxResults = opts.maxResults ?? 5;

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: env.tavilyApiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily error ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as TavilyResponse;
  const results = Array.isArray(json.results) ? json.results : [];
  return results
    .map(coerceResult)
    .filter((r): r is TavilySearchResult => r !== null);
}
