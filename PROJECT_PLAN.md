# PROJECT_PLAN.md

## Goal

Ship a working, demo-able, dogfood-able multi-agent job application system in 6-8 weeks. The product must be usable by James for his real job search by end of Week 4.

## Definition of done (for the project)

- James can paste any job posting URL and watch 7 agents produce a complete prep packet in under 3 minutes
- James can manage his actual job pipeline in the Tracker
- The dashboard demos cleanly in 90 seconds with no setup
- Architecture is documented in a blog post
- A 3-minute demo video exists

## Current phase

**→ Week 1: Foundation — Phase 2 done, Phase 3 (integration + smoke test) is next**

See `HANDOFF.md` for the detailed state and Phase 3 punch list.

Update this marker as work progresses. Always check this before starting a session.

---

## Week-by-week

### Week 1 — Foundation

**Goal:** prove the architecture by getting one agent working end-to-end with streaming UI.

- [x] Monorepo scaffold (pnpm workspaces: `backend/`, `frontend/`, `shared/`)
- [x] Backend: Express + TypeScript + Socket.io
- [x] Frontend: Vite + React + TypeScript + Tailwind
- [x] MongoDB Atlas connection (free tier) *(code in place; not yet exercised against a real Mongo — needs `.env`)*
- [x] Auth: simple email/password with sessions *(login-only, seeded user — per `auth-scope` decision)*
- [x] Shared types package for agent event schemas
- [x] Anthropic API client wrapper with cost logging to MongoDB *(`callClaudeWithLogging`; not yet exercised against the real API)*
- [x] **Company Researcher agent** — first agent, full implementation
  - [x] System prompt
  - [x] Web search tool integration (Tavily)
  - [x] Streaming events: `status`, `thought`, `tool_call`, `finding`, `complete`, `error`
  - [x] Hard caps: max_tokens 3000, max_tool_calls 8 *(enforced in code as constants, not just prompt)*
- [x] **Dashboard skeleton** with one panel showing Company Researcher events in real time
- [ ] **Phase 3 — Integration:** wire `POST /api/runs` to dispatch the agent, thread `runId` through `Agent.run()`, return cost from the wrapper, hoist `subscribe:run` payload schema into `shared/`
- [ ] Test: submit a real company name, watch the panel populate, get a final dossier *(blocked on `.env` + Phase 3 integration)*

**End-of-week demo:** type "Stripe" into a form, watch the Company Researcher panel light up with search queries and findings, end up with a structured dossier on screen.

### Week 2 — Agent buildout

**Goal:** orchestrator coordinating 4 agents in parallel.

- [ ] **Orchestrator** — parses JD, plans dispatch, manages parallel execution
- [ ] **JD Analyst agent** — extracts requirements, nice-to-haves, red flags (Haiku)
- [ ] **Resume Tailor agent** — proposes targeted edits with reasoning (Sonnet)
- [ ] **People Finder agent** — identifies hiring manager / recruiter candidates (Haiku + search)
- [ ] Dashboard: 4 agent panels rendering in parallel from a single event stream
- [ ] Master resume schema + ingestion flow (paste structured JSON for now, parser comes later)
- [ ] End-to-end: submit a JD URL, 4 agents run in parallel, raw outputs visible

**End-of-week demo:** paste a real job posting, see 4 agents work simultaneously, see structured outputs from each.

### Week 3 — Writing agents + voice

**Goal:** full packet generation working end-to-end.

- [ ] **Cover Letter Writer agent** — uses voice profile + dossier + JD + resume (Sonnet, Opus for "deep mode")
- [ ] **Interview Prep agent** — runs after first wave completes, synthesizes everything
- [ ] **Voice profile system** — onboarding flow: upload 3-5 writing samples, analyze, store profile
- [ ] Final synthesis step in orchestrator that produces the packet view
- [ ] Packet view: dossier (collapsible), fit summary, tailored resume with diff, cover letter with annotations, contacts, interview prep
- [ ] Editable cover letter (in-place editing, save back to packet)

**End-of-week demo:** full pipeline produces complete, voice-matched packet.

### Week 4 — Tracker

**Goal:** James can use the product on his real job search.

- [ ] Application data model: status, JD URL, packet ID, salary, contact log, notes, dates
- [ ] Kanban board: Saved → Applied → Phone Screen → Technical → Onsite → Offer → Closed
- [ ] Application detail view linking back to packet
- [ ] Follow-up reminders (email or in-app, in-app is simpler)
- [ ] Funnel dashboard: response rate, days-to-response, conversion stages
- [ ] "Save packet to tracker" flow from Studio
- [ ] Resume PDF parser (use a library — pdf-parse or similar) for ingestion

**End-of-week milestone:** James uses the product for every real application from this point forward.

### Week 5 — Dogfooding

**Goal:** fix everything that's actually broken in real-world use.

This is the most important week. No new features unless they're discovered as gaps from real use. Track issues as they come up. Common things to expect:

- Edge cases in JD parsing (jobs with no clear requirements, jobs with 50 nice-to-haves)
- Hallucinated facts in dossiers (add citation enforcement)
- Cover letters that still don't sound like James (tune voice profile)
- Slow agents (parallelize harder, switch some to Haiku)
- UI rough edges that break in real use

### Week 6 — Polish

**Goal:** make the demo shine.

- [ ] Visual polish on dashboard — read frontend-design skill first
- [ ] Error states for every agent
- [ ] Empty states for tracker
- [ ] Loading states everywhere
- [ ] Mobile responsive on Tracker (Studio can be desktop-only)
- [ ] Cost dashboard for James's own visibility
- [ ] "Deep mode" / "Standard mode" toggle on Studio submission
- [ ] Performance: dashboard renders 7 agents without lag

### Weeks 7-8 — Launch

**Goal:** make the work visible.

- [ ] Detailed blog post on the agent orchestration architecture (target: dev.to + personal site)
- [ ] 3-minute demo video (script it, don't ramble)
- [ ] Polished README with architecture diagram
- [ ] Open source on GitHub under `JamesxFarris/application-studio` or branded name
- [ ] Show HN post (optional, depends on quality)
- [ ] LinkedIn announcement post
- [ ] Add to portfolio site and resume

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope creep | Each week has a defined demo. If you can't demo it, you didn't finish. |
| Cost runaway | Hard caps in code from Day 1. Dashboard alerts. See COST_CONTROLS.md. |
| Voice matching produces slop | Voice profile + iterative feedback loop. Real samples, not generic style guides. |
| Hallucinated company facts | Citation discipline in research agent's system prompt. Show sources in dossier UI. |
| LinkedIn lookups blocked | Use Google search for `site:linkedin.com "Company Name" recruiter` patterns. Manual paste fallback. |
| Wasting time on auth | Single-user mode for v1. Multi-user comes only if there's product-market fit. |

## Out of scope for v1

- Auto-applying to jobs (never)
- Resume PDF parsing on Day 1 (use JSON ingestion first, add parser in Week 4)
- Multi-user accounts beyond James
- Mobile app
- Browser extension for one-click JD capture (great v2 idea)
- Integration with LinkedIn Easy Apply
- Slack / Discord notifications
