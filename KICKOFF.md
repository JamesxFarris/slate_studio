# KICKOFF.md

Practical guide for your first Claude Code session on this project. Read once, then start.

## Ground rule before anything else: secrets discipline

A multi-agent app has more secrets than a typical project: Anthropic API key, MongoDB connection string (with embedded password), Tavily API key, session secret. Treat all of them as load-bearing.

- All secrets live in a `.env` file in the project root
- `.env` is in `.gitignore` from commit 1 (verify before your first push)
- Never paste a real secret into chat, Slack, code comments, or commits
- Use `.env.example` (committed) to document what env vars are needed, with placeholder values only
- For production, set env vars in the hosting dashboard (Railway / Render / Vercel), not in files
- If a secret leaks: rotate it immediately. Atlas password, Anthropic key, Tavily key — all rotatable in their dashboards in under a minute.

A leaked Anthropic key can rack up four-figure bills before you notice. A leaked Atlas connection string can let someone wipe your data. Both have happened to indie devs. Don't let it happen here.

## Before you open Claude Code

### 1. Create accounts and gather credentials

- [ ] Anthropic API: console.anthropic.com — fund with $50
- [ ] MongoDB Atlas: reuse your existing `Cluster0`. Slate Studio will live in a new database (`slate_studio`) on that cluster. No new cluster needed — Atlas creates the database on first write.
- [ ] Tavily: tavily.com — sign up, get API key (1000 free searches/month)
- [ ] Repo name: `slate-studio`

### MongoDB setup notes (reusing existing cluster)

You already have `Cluster0` (`cluster0.ypo5wnh.mongodb.net`) set up for another project. Slate Studio will share this cluster.

Connection string template (put real password in `.env`, never commit):

```
MONGODB_URI=mongodb+srv://jafarris:<password>@cluster0.ypo5wnh.mongodb.net/slate_studio?retryWrites=true&w=majority&appName=Cluster0
```

The `slate_studio` segment after the hostname is the database name — different from your other project's database, so collections won't collide.

**Recommended:** create a scoped database user with access only to `slate_studio` (Atlas → Database Access → Add New User → Specific Privileges → readWrite on `slate_studio`). This way a bug in one project can never touch the other's data. Takes 30 seconds.

**Also check:** Atlas → Network Access. If your IP allowlist is `0.0.0.0/0` (allow from anywhere), tighten it to your home IP. The free tier defaults to wide-open allowlists which is fine for prototyping but worth fixing before you have real data.

**Free tier limits to watch:** 512MB storage shared across all databases on the cluster, 500 concurrent connections. Both projects share this budget. Not an issue at v1 scale but check Atlas dashboard occasionally once you start dogfooding heavily.

### 2. Install prerequisites

```bash
# Node 20+ (check with `node --version`)
# pnpm
npm install -g pnpm

# Claude Code (if not already installed)
npm install -g @anthropic-ai/claude-code
```

### 3. Create the project folder and drop the planning bundle

Put this entire `job-app-agent-planning/` directory's contents at the root of your new project repo. The `.claude/agents/` folder is critical — Claude Code reads subagents from there.

```
your-repo/
├── CLAUDE.md
├── PROJECT_PLAN.md
├── SPECIFICATION.md
├── ARCHITECTURE.md
├── TECH_STACK.md
├── COST_CONTROLS.md
├── KICKOFF.md  (this file)
└── .claude/
    └── agents/
        ├── backend-architect.md
        ├── frontend-builder.md
        ├── agent-engineer.md
        └── reviewer.md
```

### 4. Initialize git

```bash
cd your-repo
git init
git add .
git commit -m "Planning bundle"
```

Push to a private GitHub repo. Make it public when you're proud of it (Week 7).

## First Claude Code session

Open a terminal in your project root and run `claude`.

### Opening prompt

Paste this verbatim:

```
Read CLAUDE.md, PROJECT_PLAN.md, SPECIFICATION.md, ARCHITECTURE.md, TECH_STACK.md, and COST_CONTROLS.md. Then summarize: (1) what this project is in three sentences, (2) what Week 1 needs to deliver, (3) the first three concrete actions you'd take. Do not write any code yet.
```

This is a comprehension check. If Claude Code's summary is off, fix the planning docs before building. Better to catch misunderstandings now than after 2 weeks of misaligned code.

### Second prompt (after confirming alignment)

```
Plan Week 1 step by step. Identify which steps can be parallelized by spawning the backend-architect, frontend-builder, and agent-engineer subagents simultaneously, and which must be serial. Output a numbered action plan with the subagent assigned to each step. Do not write code yet.
```

Review the plan. Push back on anything wrong. Once the plan is solid, the next prompt is just:

```
Execute the plan. Use subagents in parallel where you identified parallelism. Pause and confirm with me before each major commit.
```

### Workflow rhythm

- **Start of session:** `read PROJECT_PLAN.md and tell me the current phase and what's next`
- **During session:** delegate to subagents when work touches multiple layers
- **Before committing:** invoke `reviewer` subagent
- **End of session:** `update PROJECT_PLAN.md with what we completed and what's left in the current phase`

### Plan Mode

Use Plan Mode (`shift+tab`) for any prompt involving more than 2-3 file changes. Review the plan, accept it, then let Claude Code execute. This dramatically reduces rework.

### Context management

- Start a fresh session per phase (Week 1 in one session, Week 2 in another)
- Use `/clear` between unrelated tasks within a session
- If context gets above ~70%, run `/compact` with a prompt like "preserve the current phase status, file changes made, and any open TODOs"

## Common pitfalls to avoid

1. **Letting Claude Code skip the planning docs.** Always start sessions with a read of relevant docs. The whole point of the bundle is to keep context tight.
2. **Working on multiple weeks at once.** Finish a week's demo target before starting the next.
3. **Skipping verification.** "It compiles" is not "it works." Run the code.
4. **Skipping the reviewer subagent.** It catches cost-rule violations and type-safety gaps before they ship.
5. **Letting cover letters drift back to ChatGPT-default voice.** Test voice matching every time you touch the Cover Letter agent.
6. **Forgetting to update PROJECT_PLAN.md.** It's the source of truth for "where are we." If it's stale, you'll get lost.

## When you get stuck

- Stuck on architecture? Re-read ARCHITECTURE.md and ask Claude Code to explain the relevant section back to you. If it can't, the doc needs improvement.
- Stuck on an agent prompt? Ask `agent-engineer` to draft three variations, pick one, test on a real JD.
- Stuck on a UI decision? Reference the design language in TECH_STACK.md and the frontend-design skill. When in doubt, ship the simpler version.
- Stuck on cost? Check the `tokenUsage` collection and find the heaviest agent. Tune from there.

## Success looks like

- Week 1: one agent works end-to-end with a streaming UI panel. You're excited.
- Week 4: you're using your own tool for real applications. It's saving you time.
- Week 8: blog post is live, demo video is recorded, GitHub repo is polished. You're showing this in interviews.

Now stop reading and go build. The planning is done.
