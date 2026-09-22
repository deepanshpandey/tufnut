# Tufnut — Socratic DSA Tutor

> **"A patient DSA interviewer sitting beside you — not ChatGPT that solves LeetCode problems."**

---

## Origin & Attribution

This project was inspired by **Striver's [TUFY bot](https://takeuforward.org)** on TakeUForward (TUF).

TUFY is a brilliant Socratic tutor built into TakeUForward that helps learners solve DSA problems through guided questioning rather than direct solutions. Striver and the TakeUForward team have built one of the most impactful free DSA resources available.

**Tufnut is not a replacement for TUF or TUFY.** It is simply a personal BYOK (Bring Your Own Key) extension that lets you use the same Socratic tutoring philosophy with your own AI API key, on any coding site you visit.

We fully respect TakeUForward's mission of free, high-quality DSA education. Please continue to support [takeuforward.org](https://takeuforward.org) and Striver's work.

---

## What Is Tufnut?

Tufnut is a **Chrome Extension (Manifest V3)** that acts as a Socratic DSA tutor while you solve programming problems on sites like:

- [LeetCode](https://leetcode.com)
- [TakeUForward](https://takeuforward.org)
- [GeeksForGeeks](https://geeksforgeeks.org)
- [Codeforces](https://codeforces.com)
- Any other coding/problem-solving page (generic fallback)

### Core Philosophy

The AI is a **tutor, not a solution generator**.

- It will **never** give you the complete solution.
- It will **never** rewrite your code.
- It will guide you through Socratic questions, conceptual hints, and debugging observations.
- It respects the progressive hint model: ask for a stronger hint only when you need it.

---

## Features

| Feature | Description |
|---|---|
| 🧠 Socratic Tutor | AI asks you questions rather than giving you answers |
| 🔐 BYOK | Bring Your Own Key — no backend, no account |
| 🌐 Multi-site | Works on LeetCode, TUF, GFG, Codeforces, and more |
| 📋 Problem Detection | Automatically extracts problem title, statement, examples, constraints |
| 💻 Code Detection | Detects Monaco, CodeMirror, textarea, and contenteditable editors |
| 📎 Manual Code Paste | Paste your code manually when auto-detection fails |
| 🎯 Progressive Hints | 5 hint levels from Socratic question → strong hint |
| 🛡️ Spoiler Guard | Automatic detection and regeneration if response reveals too much |
| 🌙 Dark Mode | Follows system preference |
| ⚙️ Configurable | Choose your AI provider, model, and API key in settings |

---

## AI Providers

| Provider | Notes |
|---|---|
| OpenAI | gpt-4o-mini, gpt-4o, gpt-4-turbo, gpt-3.5-turbo |
| Anthropic | claude-3-5-haiku, claude-3-5-sonnet, claude-3-opus |
| Google Gemini | gemini-1.5-flash, gemini-1.5-pro |
| OpenRouter | Any model available on openrouter.ai |
| **Ollama (local)** | Any locally-pulled model — no API key needed, no data leaves your machine |

### Using Ollama

1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull llama3.2` (or `codellama`, `mistral`, `deepseek-coder-v2`, etc.)
3. Start the server: `ollama serve`
4. In Tufnut settings, select **Ollama (local)** and enter your server URL (default: `http://localhost:11434`)
5. Click **↺** to fetch your locally available models, pick one, and save

Your code never leaves your machine when using Ollama.

---

## Privacy

Your API key is stored **locally** in the extension using `chrome.storage.local`. It is:

- Never sent to any server operated by Tufnut
- Never logged, tracked, or synced
- Used **only** to communicate directly with the AI provider you selected

Your code and problem context are sent to your chosen AI provider when you ask the tutor for help. No other data leaves your browser.

---

## Project Structure

```
src/
├── background/
│   └── service-worker.ts        # Manifest V3 background worker
│
├── content/
│   ├── index.ts                 # Content script entry — extraction pipeline
│   ├── extractors/
│   │   ├── leetcode.ts          # LeetCode-specific extractor
│   │   ├── takeuforward.ts      # TakeUForward-specific extractor
│   │   ├── geeksforgeeks.ts     # GFG-specific extractor
│   │   ├── codeforces.ts        # Codeforces-specific extractor
│   │   └── generic.ts           # Generic fallback extractor
│   │
│   └── code/
│       ├── monaco.ts            # Monaco editor code reader
│       ├── codemirror.ts        # CodeMirror 5 & 6 code reader
│       ├── textarea.ts          # Textarea / contenteditable reader
│       └── generic.ts           # Tries all extractors in order
│
├── sidepanel/
│   ├── index.tsx                # React entry point
│   ├── App.tsx                  # Root component (tutor ↔ settings)
│   ├── sidepanel.html           # HTML shell
│   ├── components/
│   │   ├── TutorView.tsx        # Main conversation UI
│   │   ├── SettingsView.tsx     # API key + model configuration
│   │   ├── MessageBubble.tsx    # Chat message bubble
│   │   ├── ProblemHeader.tsx    # Extracted problem display
│   │   └── CodePaste.tsx        # Manual code paste area
│   └── styles/
│       └── global.css           # CSS custom properties, dark mode
│
├── ai/
│   ├── providers/
│   │   ├── openai.ts            # OpenAI Chat Completions
│   │   ├── anthropic.ts         # Anthropic Messages API
│   │   ├── gemini.ts            # Google Gemini generateContent
│   │   └── openrouter.ts        # OpenRouter (OpenAI-compatible)
│   ├── tutor.ts                 # Orchestrator: prompt → provider → guard
│   ├── prompts.ts               # System prompt builder
│   └── spoilerGuard.ts          # Heuristic spoiler detection
│
├── storage/
│   └── settings.ts              # chrome.storage.local wrapper
│
├── types/
│   └── index.ts                 # All shared TypeScript types
│
└── manifest.json                # Chrome Extension Manifest V3

tests/
├── ai/
│   ├── spoilerGuard.test.ts
│   ├── prompts.test.ts
│   └── tutor.test.ts
├── content/
│   ├── generic.test.ts
│   └── codeExtractors.test.ts
└── storage/
    └── settings.test.ts
```

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Build (development, with watch)

```bash
npm run dev
```

### Build (production)

```bash
npm run build
```

### Run tests

```bash
npm test
```

### Type-check

```bash
npm run typecheck
```

### Load in Chrome

1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Click the Tufnut icon in the toolbar to open the side panel
6. Go to Settings → enter your API key → Save

---

## Hint Levels

| Level | Name | Behaviour |
|---|---|---|
| 0 | Socratic Question | Asks a probing question, gives no information |
| 1 | Directional Hint | Points out what aspect you're not considering |
| 2 | Conceptual Hint | Explains a general concept, no algorithm name |
| 3 | Strong Hint | Names a relevant data structure/algorithm category |
| 4 | Confirmation | Confirms the student's correct idea, asks them to plan before coding |

The hint level only increases when you explicitly click **Stronger Hint**.

---

## Spoiler Guard

Every AI response is checked by `spoilerGuard.ts` before being displayed:

- **Large code blocks** (≥5 lines) → blocked
- **Tell-tale solution phrases** ("here is the solution", "you should use", etc.) → blocked
- **Long numbered lists** (≥4 items) → blocked (looks like implementation steps)
- **Inline code with braces + semicolons** → blocked

If a spoiler is detected, the response is discarded and the model is asked to regenerate a single Socratic question instead (up to 2 attempts).

---

## Roadmap

- [ ] Phase 12: Chrome Web Store listing + icons
- [ ] Custom OpenRouter model input
- [ ] Problem history / session save
- [ ] LeetCode-specific language selector integration
- [ ] Keyboard shortcut to open side panel

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Tufnut is an independent project and is not affiliated with TakeUForward, LeetCode, Google, Anthropic, or OpenAI.*
