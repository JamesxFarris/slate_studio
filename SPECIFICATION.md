# SPECIFICATION.md

## Product overview

A multi-agent job application research and prep system. Two integrated surfaces share a backend.

## Users

V1: James only (single user).
V2+: other job searchers, if PMF emerges.

## Surface 1: Studio (the main agent dashboard)

### Entry

User pastes a job posting URL or full JD text into a submission form. Optional: select "Standard" or "Deep" mode (model tier toggle).

### Flow

1. User submits JD
2. Backend creates an `applicationRun` record (`pending` status)
3. Orchestrator parses the JD, plans agent dispatch
4. Wave 1 — 5 agents run in parallel:
   - Company Researcher
   - JD Analyst
   - Resume Tailor
   - Cover Letter Writer
   - People Finder
5. Wave 2 — Interview Prep agent runs once Wave 1 completes, with access to all Wave 1 outputs
6. Orchestrator synthesizes everything into the final packet
7. Packet view loads with all sections populated
8. User can edit cover letter inline, accept/reject resume edits, save packet to Tracker

### Dashboard UI requirements

- Dark mode default (technical/terminal aesthetic, NOT Material UI)
- Reference vibe: Linear, Vercel dashboard, Claude Code itself
- 7 agent cards laid out in a 3-column grid (desktop), single column (mobile)
- Each card:
  - Header: agent name, icon, current status indicator (idle / working / done / error)
  - Streaming thought log (most recent on top, fades older entries)
  - Live tool call indicator ("🔧 Searching: 'Acme Corp Series B funding'")
  - Key findings as they emerge (small cards within the panel)
  - Token usage counter (small, bottom)
- Top of dashboard: master progress bar + total elapsed time + total cost so far
- Cards animate in (subtle scale + fade) when their agent starts
- Cards collapse to a thin summary row when done, expandable on click

### Packet view sections

1. **Fit Summary** — overall match score (0-100), top 3 strengths to lead with, top 3 gaps to acknowledge
2. **Company Dossier** — collapsible, citations linked
3. **JD Breakdown** — must-haves vs nice-to-haves vs noise; red flags (unicorn-list jobs, unrealistic stacks, etc.)
4. **Tailored Resume** — side-by-side diff with master; accept/reject each change with one click
5. **Cover Letter** — editable; hover any sentence to see why the agent wrote it that way (citation back to JD or dossier)
6. **People to Contact** — cards with name, role, LinkedIn URL, drafted outreach message
7. **Interview Prep** — technical study topics, behavioral STAR prompts, reverse questions to ask them

### Exports

- Resume → .docx (ATS-parseable)
- Cover letter → .docx or copy-to-clipboard
- Full packet → PDF
- Outreach messages → copy-to-clipboard

## Surface 2: Board (the Kanban tracker)

### Kanban columns

`Saved` → `Applied` → `Phone Screen` → `Technical Interview` → `Onsite` → `Offer` → `Closed`

`Closed` cards have a sub-reason: `Rejected`, `Withdrew`, `Ghosted`, `Accepted Other`.

### Card data

- Company name, role title
- Original JD URL
- Linked packet (button to view)
- Salary range if known
- Date applied
- Last activity date
- Next action + due date
- Contact log (timestamped notes)
- Interview round notes

### Funnel dashboard

- Applications this week / this month
- Response rate (Applied → Phone Screen %)
- Average days to first response
- Conversion through each stage
- Stale applications (no activity > 7 days in Applied) highlighted

## Data models

### User
```typescript
{
  _id: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
  masterResumeId: ObjectId;
  voiceProfileId: ObjectId;
  apiUsageCents: number;  // cumulative
}
```

### MasterResume
Structured representation. Tailoring works by selecting/editing from this superset.
```typescript
{
  _id: ObjectId;
  userId: ObjectId;
  basics: { name, email, phone, location, links: { linkedin, github, portfolio } };
  summary: string;  // base summary, tailored per-application
  experience: Array<{
    company, role, startDate, endDate, location,
    bullets: Array<{
      id: string,
      text: string,
      tags: string[],  // technologies, skill categories, impact metrics
    }>
  }>;
  projects: Array<{ name, description, link, bullets, tags }>;
  education: Array<{ school, degree, dates, notes }>;
  skills: { languages: string[], frameworks: string[], tools: string[], other: string[] };
  certifications: Array<{ name, issuer, date }>;
}
```

### VoiceProfile
```typescript
{
  _id: ObjectId;
  userId: ObjectId;
  samples: Array<{ source: string, text: string }>;  // 3-5 writing samples
  styleGuide: {
    sentenceLengthAvg: number;
    contractionsUse: 'frequent' | 'occasional' | 'never';
    formality: 'casual' | 'neutral' | 'formal';
    humorPresence: 'frequent' | 'occasional' | 'never';
    hedging: 'low' | 'medium' | 'high';
    vocabularyNotes: string;
    avoidPhrases: string[];  // user-flagged "doesn't sound like me" phrases
    preferredPhrases: string[];  // user-flagged "sounds like me" phrases
  };
  updatedAt: Date;
}
```

### ApplicationRun
```typescript
{
  _id: ObjectId;
  userId: ObjectId;
  jdUrl?: string;
  jdText: string;
  mode: 'standard' | 'deep';
  status: 'pending' | 'running' | 'complete' | 'error';
  startedAt: Date;
  completedAt?: Date;
  agentOutputs: {
    companyDossier?: object;
    jdAnalysis?: object;
    resumeTailoring?: object;
    coverLetter?: object;
    people?: object;
    interviewPrep?: object;
  };
  totalCostCents: number;
  totalTokens: { input: number, output: number };
  packetId?: ObjectId;  // set when synthesis completes
}
```

### Packet
The final synthesized output linked to a Run.
```typescript
{
  _id: ObjectId;
  runId: ObjectId;
  userId: ObjectId;
  company: string;
  role: string;
  fitSummary: { score: number, strengths: string[], gaps: string[] };
  dossier: { sections: Array<{ heading, content, citations }> };
  jdBreakdown: { mustHaves, niceToHaves, redFlags };
  tailoredResume: { edits: Array<{ bulletId, original, proposed, reasoning, accepted? }> };
  coverLetter: { content: string, annotations: Array<{ sentenceIdx, reasoning }> };
  contacts: Array<{ name, role, linkedinUrl, outreachDraft }>;
  interviewPrep: { technicalTopics, behavioralPrompts, questionsToAsk };
  createdAt: Date;
  lastEditedAt: Date;
}
```

### Application (Tracker entity)
```typescript
{
  _id: ObjectId;
  userId: ObjectId;
  packetId?: ObjectId;  // optional, can manually add applications without a packet
  company: string;
  role: string;
  jdUrl?: string;
  status: 'saved' | 'applied' | 'phone_screen' | 'technical' | 'onsite' | 'offer' | 'closed';
  closedReason?: 'rejected' | 'withdrew' | 'ghosted' | 'accepted_other';
  salaryMin?: number;
  salaryMax?: number;
  appliedAt?: Date;
  lastActivityAt: Date;
  nextAction?: string;
  nextActionDueAt?: Date;
  contactLog: Array<{ at: Date, who: string, channel: string, note: string }>;
  interviewNotes: Array<{ round: string, at: Date, notes: string }>;
  createdAt: Date;
}
```

## Onboarding flow (first-time user)

1. Sign up (email + password)
2. Upload master resume:
   - V1: paste structured JSON (we provide a template)
   - V2 (Week 4): upload PDF, parser extracts structure, user reviews/edits
3. Upload 3-5 writing samples (paste text, label source — "Slack message", "personal essay", etc.)
4. Voice profile agent analyzes samples and generates the style guide
5. User reviews the inferred style guide, edits if needed
6. Done — first Studio submission unlocked

## Voice feedback loop

After generating a cover letter, user can hover any sentence and click "sounds like me" or "doesn't sound like me". These selections update `preferredPhrases` and `avoidPhrases` on the VoiceProfile. Cover Letter agent's system prompt includes these lists, so quality improves over time.

This is the magic moment that makes the tool sticky and gives it a moat.

## Cost transparency

User-facing cost dashboard shows:
- Total spent this month
- Cost per application (with breakdown by agent)
- Mode comparison (avg standard vs avg deep)
- Remaining API credit balance (pulled from Anthropic console if possible, otherwise manual entry)
