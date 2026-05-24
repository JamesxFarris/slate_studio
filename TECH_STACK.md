# TECH_STACK.md

Stack decisions with rationale. Don't deviate without discussion.

## Monorepo

**Choice:** pnpm workspaces

**Rationale:** Shared TypeScript types between backend and frontend (agent event schemas) are the killer use case. pnpm is faster than npm/yarn for monorepos and the disk usage is much better.

Structure:
```
application-studio/
├── backend/          # Express + Socket.io API
├── frontend/         # Vite + React dashboard
├── shared/           # Zod schemas, event types, shared utilities
├── docs/             # Blog post drafts, architecture diagrams
├── CLAUDE.md         # Root context
├── PROJECT_PLAN.md
├── SPECIFICATION.md
├── ARCHITECTURE.md
├── TECH_STACK.md
├── COST_CONTROLS.md
└── .claude/
    └── agents/       # Build-time subagent definitions
```

## Backend

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 20+ | LTS, good Anthropic SDK support |
| Language | TypeScript (strict mode) | Type safety on agent contracts is essential |
| Framework | Express | James knows it (MERN), low surprise factor |
| WebSocket | Socket.io | Easier than raw WS for room management, reconnection |
| Database | MongoDB Atlas (free tier) | James knows it, free tier sufficient for v1 |
| ODM | Mongoose | Schema validation matches Zod patterns |
| Validation | Zod | Used for both runtime validation and TS type inference |
| Auth | express-session + bcrypt | Simple, single-user for v1 |
| LLM client | `@anthropic-ai/sdk` | Official Anthropic SDK |
| Web search | Tavily API | Built for AI agents, better than Brave for this |
| PDF parsing | `pdf-parse` | Week 4 only, for resume ingestion |

## Frontend

| Concern | Choice | Why |
|---|---|---|
| Build tool | Vite | Fast HMR, zero-config TypeScript |
| Framework | React 18+ | James knows it |
| Language | TypeScript | Required |
| Styling | Tailwind CSS | Fast iteration, dark-mode native |
| UI primitives | shadcn/ui | Drop-in components, fully customizable, dark-mode friendly |
| State | Zustand | Simpler than Redux, sufficient for this scope |
| Server state | TanStack Query | Cache + revalidation for tracker/packet data |
| WebSocket client | `socket.io-client` | Pairs with backend |
| Routing | React Router v6+ | Standard |
| Animations | Framer Motion | Agent panel transitions, packet section reveals |
| Icons | Lucide React | Matches shadcn/ui aesthetic |
| Forms | React Hook Form + Zod | Resolver matches backend validation |
| Diff view | `react-diff-viewer-continued` | Resume edit accept/reject UI |
| Markdown rendering | `react-markdown` | Cover letter editing |
| Charts | Recharts | Funnel dashboard |

## DevOps / hosting

| Concern | Choice | Why |
|---|---|---|
| Backend hosting | Railway or Render | Easy Node deploys, sane pricing |
| Frontend hosting | Vercel | Best Vite/React deploy experience |
| DB | MongoDB Atlas free tier | 512MB sufficient for v1 single-user |
| Secret management | `.env` locally, host env vars in prod | Standard |
| CI | GitHub Actions | Free for public repos |

**Cost ceiling for hosting v1:** $0/month if you stay in free tiers. Railway has a small free credit, Render free tier sleeps after inactivity (annoying but acceptable for personal use).

## Why not...

**Why not Next.js?** Splitting backend (long-running agent jobs + WebSocket) from frontend is cleaner here. Next.js API routes are awkward for streaming agent events. Vite + Express is the right tool for the job.

**Why not Python/FastAPI for the backend?** Python has a slightly nicer Anthropic SDK ergonomically, but James's stack is JS. Don't context-switch languages for marginal gain.

**Why not LangChain / LlamaIndex?** They add abstraction without value here. Direct Anthropic SDK calls are clearer, easier to debug, and don't lock you in. Multi-agent orchestration in this app is simple enough to write in plain TypeScript.

**Why not Inngest / Trigger.dev for agent jobs?** Tempting, and would handle retries/timeouts nicely. But adds another service. For v1, keep agents running in-process with Node's async primitives. Migrate to job queue only if v1 has scale needs.

**Why not GraphQL?** Overkill. REST + WebSocket events is simpler and the data shape is straightforward.

**Why not a serverless platform (Lambda / Cloudflare Workers)?** Agent runs are 1-3 minutes with active WebSocket connections. Serverless is wrong for this workload. A long-running Node process is the right shape.

## Tools James needs accounts for

- Anthropic API account (console.anthropic.com) — fund with $50 to start
- MongoDB Atlas (free tier)
- Tavily account (1000 free searches/month, then pay-as-you-go)
- Vercel account (free)
- Railway or Render account (free tier)
- GitHub (already has, JamesxFarris)
