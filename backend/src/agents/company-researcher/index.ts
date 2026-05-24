// Company Researcher — first runtime agent per ARCHITECTURE.md.
//
// Job: research a company so the rest of the pipeline (and the user) has a
// dossier with citations on overview, recent news, funding, tech/culture
// signals, and risk factors. Refuses to fabricate — empty fields beat made-up
// facts. Cost-disciplined: max 8 tool calls, max 3000 output tokens.

import type Anthropic from '@anthropic-ai/sdk';
import {
  type CompanyResearcherInput,
  CompanyResearcherInputSchema,
  type CompanyResearcherOutput,
  CompanyResearcherOutputSchema,
  type Citation,
} from '@slate/shared';
import { callClaudeWithLogging } from '../../llm/callClaudeWithLogging.js';
import { tavilySearch, type TavilySearchResult } from '../../llm/tavily.js';
import { logger } from '../../logger.js';
import type { Agent, EmitFn } from '../contract.js';

const ID = 'company-researcher' as const;
const MAX_TOKENS = 3000;
const MAX_TOOL_CALLS = 8;

// Output shape inlined into the system prompt as a literal JSON example.
// Keeping this separate from the schema definition so the prompt stays
// stable even if we add optional fields to the schema later.
const OUTPUT_JSON_EXAMPLE = `{
  "sections": [
    {
      "heading": "Company Overview",
      "content": "1-3 paragraphs of plain-text overview. Every factual claim must be supported by a citation in this section's citations array.",
      "citations": [
        { "url": "https://example.com/about", "title": "About — Example", "snippet": "optional 1-line snippet" }
      ]
    },
    {
      "heading": "Recent News",
      "content": "What has happened in the last ~90 days. Layoffs, launches, leadership changes, funding announcements. If nothing material found, write 'No notable news in the last 90 days based on the sources reviewed.'",
      "citations": []
    },
    {
      "heading": "Funding & Growth",
      "content": "Funding rounds, valuations, headcount trajectory. If unknown, say 'unknown' explicitly.",
      "citations": []
    },
    {
      "heading": "Tech & Culture Signals",
      "content": "Signals from engineering blog, public talks, GitHub presence, glassdoor sentiment (general direction only — do not invent numbers).",
      "citations": []
    },
    {
      "heading": "Risk Factors",
      "content": "Concerning signals a candidate should weigh: recent layoffs, leadership churn, funding age, market headwinds. Empty array of risks is fine; do not invent risks.",
      "citations": []
    }
  ],
  "oneLineSummary": "One sentence (<=160 chars) that captures the company in plain language."
}`;

const SYSTEM_PROMPT = `You are the Company Researcher agent for Slate Studio, a job-application prep tool.

Your job: produce a skeptical, citation-backed dossier on a company so the user can decide whether to apply and how to position themselves.

# Operating rules

1. CITE EVERYTHING. Every factual claim (funding amount, headcount, news event, leadership name, tech choice) must be supported by a citation drawn from a tool result you saw. Citations live in the relevant section's citations array.
2. NEVER FABRICATE. If you cannot find evidence for something — funding round size, headcount, recent news, tech stack — write "unknown" or omit the claim. Do not guess. Do not extrapolate from a logo on a customer page into a "partnership."
3. PREFER PRIMARY SOURCES. Company website / blog / SEC filings / official press > tech press > rumor sites. Skip content farms.
4. RECENT NEWS = LAST ~90 DAYS. Older events go in Company Overview or Funding & Growth, not Recent News.
5. BE BRIEF. Each section: 1-3 short paragraphs of plain text. No bullet lists inside content strings. No markdown. The user reads this on a card.
6. TOOL BUDGET. You have at most ${MAX_TOOL_CALLS} tool calls total. Spend them well. Typical plan: 1 overview search, 1 recent-news search, 1 funding search, 1 tech/culture search, 1-2 web_fetch on the highest-signal URLs. Stop early if you have enough.
7. THOUGHTS ARE SHORT. When you reason aloud (outside tool calls), keep thoughts under 20 words — they render live in a UI panel.

# Tools

You have:
- web_search(query): returns a small ranked list of {url, title, content, score}. Use targeted queries; do not search the company name alone.
- web_fetch(url): returns the cleaned text of a page (truncated). Use when a search snippet looks high-signal and you need more context.

# Output

When you have enough information, respond with ONE final assistant message containing ONLY a JSON object (no prose, no markdown fences) that matches this exact schema:

${OUTPUT_JSON_EXAMPLE}

The heading values are a closed set — use those exact five strings, in that order. citations is always an array (may be empty). oneLineSummary is required.

If you produce anything other than valid JSON matching this schema, the run fails.`;

// ---------- Tool definitions (Anthropic JSON schema) ----------

const WEB_SEARCH_TOOL: Anthropic.Messages.Tool = {
  name: 'web_search',
  description:
    'Search the public web via Tavily. Returns a small ranked list of {url, title, content, score}. Use targeted queries (e.g. "Stripe Series I funding 2024" not just "Stripe"). Returns up to 5 results.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific; include year or topic.',
      },
    },
    required: ['query'],
  },
};

const WEB_FETCH_TOOL: Anthropic.Messages.Tool = {
  name: 'web_fetch',
  description:
    'Fetch a URL and return the page text (HTML stripped, truncated to ~5000 chars). Use after web_search when a snippet looks high-signal.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Absolute http(s) URL to fetch.',
      },
    },
    required: ['url'],
  },
};

// ---------- Tool handlers ----------

interface WebSearchInput {
  query: string;
}
interface WebFetchInput {
  url: string;
}

function isWebSearchInput(v: unknown): v is WebSearchInput {
  return typeof v === 'object' && v !== null && typeof (v as { query?: unknown }).query === 'string';
}
function isWebFetchInput(v: unknown): v is WebFetchInput {
  return typeof v === 'object' && v !== null && typeof (v as { url?: unknown }).url === 'string';
}

// Summarize tool results to ~300 chars for the tool_result event. The full
// result still goes back to the model — this summary is only for the UI feed.
function summarizeForUi(text: string, max = 300): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? collapsed.slice(0, max - 1) + '…' : collapsed;
}

// Truncate tool results before sending back to the model. Per the team's
// tool-use conventions: results over ~2000 tokens get summarized. We
// approximate token count as chars / 4 and cap at 8000 chars.
function truncateForModel(text: string, maxChars = 8000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n…[truncated ${text.length - maxChars} chars]`;
}

async function runWebSearch(query: string): Promise<{ modelText: string; uiSummary: string }> {
  const results = await tavilySearch(query, { maxResults: 5 });
  if (results.length === 0) {
    return { modelText: `No results for query: ${query}`, uiSummary: `0 results for "${query}"` };
  }
  const formatted = results
    .map(
      (r: TavilySearchResult, i: number) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\nScore: ${r.score.toFixed(2)}\nSnippet: ${r.content}`,
    )
    .join('\n\n');
  return {
    modelText: truncateForModel(formatted),
    uiSummary: summarizeForUi(`${results.length} results: ${results.map((r) => r.title).join(' | ')}`),
  };
}

async function runWebFetch(url: string): Promise<{ modelText: string; uiSummary: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': 'SlateStudio/0.1 (+research)' },
      // No AbortController here — the agent's wall-clock timeout in runner
      // is the backstop. A per-fetch timeout would just complicate failure
      // modes for marginal benefit.
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { modelText: `Fetch failed: ${msg}`, uiSummary: `fetch failed: ${msg.slice(0, 80)}` };
  }

  if (!res.ok) {
    const msg = `HTTP ${res.status} fetching ${url}`;
    return { modelText: msg, uiSummary: msg };
  }

  const raw = await res.text();
  // Crude HTML strip: drop script/style blocks, then all tags, collapse ws.
  // Good enough for dossier-level signal; we are not parsing JS-heavy SPAs.
  const stripped = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const clipped = stripped.slice(0, 5000);
  return {
    modelText: clipped + (stripped.length > 5000 ? '\n…[truncated]' : ''),
    uiSummary: summarizeForUi(clipped),
  };
}

// ---------- Tool-loop runner ----------

interface ToolDispatchResult {
  modelText: string;
  uiSummary: string;
}

async function dispatchTool(name: string, input: unknown): Promise<ToolDispatchResult> {
  if (name === 'web_search') {
    if (!isWebSearchInput(input)) {
      return { modelText: 'Invalid tool input: query (string) required.', uiSummary: 'invalid input' };
    }
    return runWebSearch(input.query);
  }
  if (name === 'web_fetch') {
    if (!isWebFetchInput(input)) {
      return { modelText: 'Invalid tool input: url (string) required.', uiSummary: 'invalid input' };
    }
    return runWebFetch(input.url);
  }
  return {
    modelText: `Unknown tool: ${name}`,
    uiSummary: `unknown tool: ${name}`,
  };
}

// Pull thoughts out of an assistant message's text blocks. Anthropic returns
// reasoning interleaved with tool_use blocks; the text portions are the
// thoughts we want to surface in the UI.
function emitTextThoughts(message: Anthropic.Messages.Message, emit: EmitFn): void {
  for (const block of message.content) {
    if (block.type === 'text' && block.text.trim().length > 0) {
      emit({ type: 'thought', payload: { text: block.text.trim() } });
    }
  }
}

// Extract the final JSON object the model produces in its terminal message.
// We accept either a bare JSON object or one wrapped in ```json fences just
// in case the model strays.
function extractFinalJson(message: Anthropic.Messages.Message): unknown {
  const textBlocks = message.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text');
  if (textBlocks.length === 0) {
    throw new Error('Final assistant message contained no text block to parse as JSON.');
  }
  const joined = textBlocks.map((b) => b.text).join('\n').trim();
  // Strip markdown fences if present.
  const fenceMatch = joined.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonSource = fenceMatch && fenceMatch[1] ? fenceMatch[1].trim() : joined;
  try {
    return JSON.parse(jsonSource);
  } catch (err) {
    const head = jsonSource.slice(0, 200);
    throw new Error(`Final output was not valid JSON. First 200 chars: ${head}`);
  }
}

// Best-effort emit of finding events as we see search results land. Keeps
// the UI panel populating in real-time rather than waiting for the final
// dossier render.
function emitFindingForSearch(query: string, uiSummary: string, emit: EmitFn): void {
  emit({
    type: 'finding',
    payload: {
      kind: 'search_result',
      content: `${query} — ${uiSummary}`,
    },
  });
}

// Citations on findings we surface live aren't strictly required by the
// schema, but populating them here would require parsing structured Tavily
// results into Citation shape. Skipped for now — the final dossier carries
// the source-of-truth citations.
const _citationTypeMarker: Citation | undefined = undefined;
void _citationTypeMarker;

async function runCompanyResearcher(
  input: CompanyResearcherInput,
  emit: EmitFn,
): Promise<CompanyResearcherOutput> {
  const userPrompt = input.role
    ? `Research the company "${input.company}". The user is considering applying for the role "${input.role}". Tailor your "Tech & Culture Signals" toward what matters for that role.`
    : `Research the company "${input.company}".`;

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

  // Tool-loop. Hard cap enforced HERE in code, not in the prompt. See
  // COST_CONTROLS.md Rule 1.
  let toolCallCount = 0;
  let finalMessage: Anthropic.Messages.Message | null = null;

  // The +1 lets the model produce its final non-tool message after using
  // its full tool budget. Without it the loop would terminate before the
  // model gets a chance to synthesize.
  const maxIterations = MAX_TOOL_CALLS + 1;

  for (let iter = 0; iter < maxIterations; iter++) {
    emit({ type: 'status', payload: iter === 0 ? 'thinking' : 'tool_use' });

    const response = await callClaudeWithLogging(
      {
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [WEB_SEARCH_TOOL, WEB_FETCH_TOOL],
        messages,
      },
      { agentId: ID, runId: '__runner_fills_via_emit__', modelKey: 'sonnet-4-6' },
    );

    // NOTE on runId above: callClaudeWithLogging needs a runId for its
    // TokenUsage write. The agent doesn't have direct access to it; we
    // pass a sentinel here and rely on the wrapper's coercion to a fresh
    // ObjectId when the value isn't a valid id. Threading the real runId
    // into the agent is a small contract improvement deferred until the
    // orchestrator lands — listed in the report.

    // Emit token telemetry for the UI cost counter.
    emit({
      type: 'tokens',
      payload: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        // Cost isn't exposed by the SDK directly; we keep this 0 here and
        // rely on the wrapper's TokenUsage write as the source of truth.
        // The UI shows a running cost from the tokens collection anyway.
        costCents: 0,
      },
    });

    emitTextThoughts(response, emit);

    const toolUses = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    );

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      // Model is done. This is the message we extract JSON from.
      finalMessage = response;
      break;
    }

    // Append the assistant's tool-use turn before adding tool results.
    messages.push({ role: 'assistant', content: response.content });

    // Enforce the tool-call budget. If adding all the tool uses in this
    // turn would exceed MAX_TOOL_CALLS, we instead synthesize a "budget
    // exhausted" tool_result for each and ask the model to finalize.
    const remaining = MAX_TOOL_CALLS - toolCallCount;
    const overBudget = toolUses.length > remaining;

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    if (overBudget) {
      logger.warn(`company-researcher hit tool-call cap (${MAX_TOOL_CALLS})`);
      for (const tu of toolUses) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content:
            'Tool budget exhausted. No further tool calls allowed. Produce the final JSON dossier now using only the evidence already gathered. If a section has no evidence, state "unknown".',
          is_error: true,
        });
      }
      messages.push({ role: 'user', content: toolResults });
      // Force one more loop iteration so the model can produce the JSON,
      // but no tools available next round means it must finalize.
      // We achieve "no more tools" implicitly by checking toolCallCount on
      // the next iteration's outputs against MAX_TOOL_CALLS in the same
      // cap check — but easier: continue, and the model usually responds
      // with end_turn after the user message above.
      continue;
    }

    for (const tu of toolUses) {
      toolCallCount += 1;
      emit({ type: 'tool_call', payload: { tool: tu.name, input: tu.input } });

      const result = await dispatchTool(tu.name, tu.input);
      emit({ type: 'tool_result', payload: { tool: tu.name, summary: result.uiSummary } });

      if (tu.name === 'web_search' && isWebSearchInput(tu.input)) {
        emitFindingForSearch(tu.input.query, result.uiSummary, emit);
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result.modelText,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalMessage) {
    throw new Error('company-researcher exhausted iteration budget without producing a final message');
  }

  emit({ type: 'status', payload: 'writing' });
  const parsedJson = extractFinalJson(finalMessage);

  // outputSchema.parse() lives in the runner, but we also do a defensive
  // parse here so the agent's own contract failure surfaces with a clear
  // message at the source rather than as a generic runner validation error.
  const parsed = CompanyResearcherOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `company-researcher output failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export const companyResearcher: Agent<CompanyResearcherInput, CompanyResearcherOutput> = {
  id: ID,
  displayName: 'Company Researcher',
  icon: 'search',
  modelKey: 'sonnet-4-6',
  maxTokens: MAX_TOKENS,
  maxToolCalls: MAX_TOOL_CALLS,
  wallClockTimeoutMs: 60_000,
  systemPrompt: SYSTEM_PROMPT,
  tools: [WEB_SEARCH_TOOL, WEB_FETCH_TOOL],
  inputSchema: CompanyResearcherInputSchema,
  outputSchema: CompanyResearcherOutputSchema,
  run: runCompanyResearcher,
};
