# CLAUDE.md

This is the root context file for **Slate Studio** — a multi-agent job application research and prep system built by James (full-stack dev, MERN background, currently job searching).

## What you are working on

A web application with two surfaces sharing one backend:

1. **Studio** (the main surface) — paste a job posting URL, watch 7 specialized agents work in parallel (visible in a real-time dashboard), receive a full prep packet (company dossier, JD analysis, tailored resume, cover letter, contact list, interview prep).
2. **Board** — Kanban tracker for managing applications through their lifecycle, linked back to generated packets, with funnel analytics.

This is **not** a spray-and-pray auto-apply tool. It is built to help James apply to fewer, better-targeted jobs with higher quality.

## Read these in order before starting any task

- @PROJECT_PLAN.md — week-by-week build plan and current phase
- @SPECIFICATION.md — full product spec, user flows, data models
- @ARCHITECTURE.md — runtime agent system (the agents that run when a user submits a JD)
- @TECH_STACK.md — stack decisions and rationale
- @COST_CONTROLS.md — API budget rules, must read before writing any agent code

## Critical project conventions

- **Two kinds of agents exist in this codebase.** Do not confuse them:
  - **Build-time subagents** (in `.claude/agents/`) — Claude Code helpers that *you* (the AI) use to build the app in parallel.
  - **Runtime agents** (in `backend/src/agents/`) — the orchestrator + 7 specialist agents that the *app itself* runs to process a job posting.
- The product never auto-submits applications. All user-facing outputs are drafts the human reviews and edits.
- Voice matching is a core differentiator. Never use generic "ChatGPT-default" prose in cover letters or outreach. Always pull the user's voice profile into writing-agent system prompts.
- Cost discipline is non-negotiable. Every runtime agent has a hard `max_tokens` and `max_tool_calls` cap. See COST_CONTROLS.md.

## Working agreement with James

- James is in his final stretch of a WGU CS degree and is job-searching now. Time is the scarce resource. Optimize for shipping, not for perfection.
- When uncertain, ask before assuming. Do not invent product requirements.
- Prefer fewer, well-tested features over many half-built ones.
- All code must run. No pseudocode commits.
- Use TypeScript for both backend and frontend.

## Build-time subagent dispatch

When given a task that touches multiple layers (backend + frontend + agent prompts), prefer to delegate to specialized build-time subagents in parallel rather than working serially in the main context. Available subagents are documented in `.claude/agents/`.

Tell James explicitly when you are about to spawn subagents and why.

## What to verify before claiming a task is done

- Code runs locally (run it, do not assume)
- No TypeScript errors
- For backend changes: relevant tests pass
- For agent changes: a dry-run of the agent on a sample JD produces sane output
- For frontend changes: screenshot or describe the visual result
