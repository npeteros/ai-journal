# JADEN — Journal Analysis & Daily Emotional Navigation

JADEN is a web-based, AI-powered journaling application that helps users reflect on their thoughts, track emotional patterns, and build a consistent journaling habit. It's an academic project benchmarked against [Mindsera](https://mindsera.com/), differentiating on **cloud AI depth and quality** — richer entry analysis, multi-perspective feedback, long-term pattern detection, and a genuinely conversational "chat with your journal" experience, all backed by frontier LLMs rather than lightweight on-device models.

> As an academic project, JADEN has no pricing tiers or paywalls — all features are free, with cloud AI usage funded by the developer's own API budget and rate-limited for cost control rather than monetization.

---

## Tech Stack

| Concern | Approach |
|---|---|
| Frontend | React / Next.js (App Router) |
| Database | Postgres, accessed via Prisma ORM (contract-first schema, migrations) |
| Authentication | Supabase Auth (email/password or OAuth) |
| Data security | TLS in transit; managed encryption at rest |
| Offline / installability | Service Worker + PWA manifest |
| Embeddings / RAG | Vector storage (e.g. pgvector) for "chat with your journal" |
| Cloud AI proxy | Next.js API Route Handlers (keeps API keys off the client) |
| AI abstraction | Provider-agnostic `analyzeEntry()`-style interface |
| Cloud AI providers | OpenAI, Anthropic |

## Architecture Principles

1. **Cloud-first storage** — a managed Postgres database, accessed via Prisma ORM, is the source of truth; the client is a thin, stateless UI.
2. **Standard security practices** — data encrypted in transit (TLS) and at rest; authentication gates access to a user's data.
3. **AI-first design** — every core reflection feature (sentiment, summaries, chat, trend analysis, personality insights) is powered by frontier cloud LLMs.
4. **No training on user data** — cloud AI calls use API providers under standard no-training terms, stated plainly in-app.
5. **Full data portability** — export (Markdown/JSON) is a first-class feature from day one.

## Feature Roadmap

- **Phase 1 — MVP: Core Loop** — distraction-free editor, cloud-backed storage, tags, dark/light theme, full export, streak tracker, daily reminders, PWA shell. No AI dependency.
- **Phase 2 — Cloud AI Basics** — sentiment/emotion tagging, AI-suggested tags, auto summaries, mood tracker visualization, AI Processing Log.
- **Phase 3 — Deeper Cloud AI** — "chat with your journal" (RAG), Minds-style multi-perspective feedback, long-term trend analysis, topic detection, personality insights, weekly digest email.
- **Phase 4 — Structure, Retrospective & Differentiation** — framework templates, custom framework builder, story/timeline view, voice/call mode, OCR journal scanning, data expiry controls, multi-language support, AI-generated entry artwork.

---

## Getting Started

Install dependencies:

```bash
npm install
```

Emit the Prisma contract (run after any `contract.prisma` change, and on fresh installs):

```bash
npm run contract:emit
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result. Pages auto-update as you edit files in `app/`.

### Other scripts

```bash
npm run build       # production build
npm run start        # run the production build
npm run lint          # eslint
npm run typecheck    # tsc --noEmit, no output
```

## Data Layer

The data layer is contract-first, built on Prisma ORM: the schema lives in `contract.prisma`, with migrations and queries generated from that contract.

## Data Handling & Transparency

| Element | Behavior |
|---|---|
| AI Processing Log | User-facing record of what was sent to cloud AI and when |
| No training clause | Stated in-app, not just in ToS |
| Export | One-tap, includes raw entries and AI analyses, in Markdown/JSON |
| Right to forget | Auto-delete/anonymize entries after a user-set period (Phase 4) |
| Encryption | TLS in transit; managed encryption at rest via database provider |
