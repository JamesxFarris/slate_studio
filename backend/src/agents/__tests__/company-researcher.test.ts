// Smoke test for the Company Researcher agent definition. Real execution
// (tool loop, live Anthropic + Tavily calls) is covered in Phase 3 with a
// recorded fixture. This file only verifies the agent's static shape so a
// regression in id / schema / cap setup fails fast.
//
// Uses node:test so we don't pull in jest/vitest.

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { companyResearcher } from '../company-researcher/index.js';
import {
  CompanyResearcherInputSchema,
  CompanyResearcherOutputSchema,
} from '@slate/shared';

describe('companyResearcher (static contract)', () => {
  it('declares the canonical id and display metadata', () => {
    assert.equal(companyResearcher.id, 'company-researcher');
    assert.equal(companyResearcher.displayName, 'Company Researcher');
    assert.equal(companyResearcher.icon, 'search');
  });

  it('uses Sonnet 4.6 with the documented hard caps', () => {
    // Per ARCHITECTURE.md Company Researcher section + COST_CONTROLS Rule 1.
    assert.equal(companyResearcher.modelKey, 'sonnet-4-6');
    assert.equal(companyResearcher.maxTokens, 3000);
    assert.equal(companyResearcher.maxToolCalls, 8);
  });

  it('attaches both tools (web_search + web_fetch)', () => {
    const names = companyResearcher.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['web_fetch', 'web_search']);
  });

  it('exposes the shared input/output schemas', () => {
    // Identity check — the agent must consume/produce the shared contract,
    // not a private copy. If these references diverge the orchestrator and
    // frontend will end up parsing different shapes.
    assert.equal(companyResearcher.inputSchema, CompanyResearcherInputSchema);
    assert.equal(companyResearcher.outputSchema, CompanyResearcherOutputSchema);
  });

  it('rejects empty company name via inputSchema', () => {
    const bad = companyResearcher.inputSchema.safeParse({ company: '' });
    assert.equal(bad.success, false);
  });

  it('accepts minimal valid input', () => {
    const ok = companyResearcher.inputSchema.safeParse({ company: 'Stripe' });
    assert.equal(ok.success, true);
  });

  it('has a non-trivial system prompt that mentions citations and the no-fabrication rule', () => {
    // Cheap smoke check — if someone deletes the prompt, this fails.
    assert.ok(companyResearcher.systemPrompt.length > 500);
    assert.match(companyResearcher.systemPrompt, /cite/i);
    assert.match(companyResearcher.systemPrompt, /(fabricat|never guess|unknown)/i);
  });
});
