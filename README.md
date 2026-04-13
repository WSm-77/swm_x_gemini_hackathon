# AIMeet

MeetAI / AIMeet — a web conferencing platform built natively around real-time AI agents.

> This repository contains the frontend and local agent runtimes used during development and demos.

## Table of contents

- [AIMeet](#aimeet)
  - [Table of contents](#table-of-contents)
  - [Features](#features)
  - [Demo videos](#demo-videos)
    - [Agents overview](#agents-overview)
    - [Screen sharing demo](#screen-sharing-demo)
  - [Quick start](#quick-start)
    - [Prerequisites](#prerequisites)
    - [Environment variables](#environment-variables)
    - [Available scripts](#available-scripts)
    - [Project layout](#project-layout)
    - [Typical local run flow](#typical-local-run-flow)
    - [Troubleshooting](#troubleshooting)

## Features
- Live Scribe — real-time transcription and collaborative notes.
- Fact Checker — live claim analysis and flagging during meetings.
- Agent-native architecture — Fishjam audio capture + Gemini Live.
- Extensible agents — designed to add more in-call agents (e.g., Live Translator).

## Demo videos

Below are two demo recordings included in this repo.

### Agents overview

<video src="resources/agents_overview.mkv" controls width="100%">Your browser does not support the video tag.</video>

### Screen sharing demo
<video src="resources/screen_sharing.mp4" controls width="100%">Your browser does not support the video tag.</video>

## Quick start

### Prerequisites

- Node.js 20+
- npm or pnpm
- Fishjam project credentials and management token
- Gemini API key (for AI features)

Install dependencies

```bash
npm install
# or
pnpm install
```

Start dev server

```bash
npm run dev -- --host
# or
pnpm dev --host
```

Start local agent helpers

```bash
# Start scribe agent (local notes service)
npm run scribe:dev
# or
pnpm scribe:dev

# Start fact-checker agent
npm run fact-checker:dev
# or
pnpm fact-checker:dev
```

### Environment variables
Create a `.env` file (copy from `.env.example` if present) and set the following values:

| Variable | Required | Description |
|---|---:|---|
| `VITE_FISHJAM_ID` | Yes | Fishjam project ID exposed to the frontend |
| `FISHJAM_ID` | Yes | Fishjam project ID used by backend/agent tooling |
| `FISHJAM_MANAGEMENT_TOKEN` | Yes | Management token for room operations |
| `GEMINI_API_KEY` | Yes | Gemini API key used by AI features/agents |
| `VITE_SCRIBE_SERVICE_URL` | Yes (for notes/AI) | Base URL for local scribe service |
| `VITE_SCRIBE_NOTES_WS_URL` | Yes (for notes/AI) | WebSocket URL for real-time notes updates |

### Available scripts

| Command | Purpose |
|---|---|
| `npm run dev -- --host` | Start Vite dev server |
| `npm run build` | Type-check and create production build |
| `npm run scribe:dev` | Start scribing agent service (local) |
| `npm run fact-checker:dev` | Start fact-checker agent service (local) |

### Project layout

- `src/` — React app and components (see `src/assets/components`)
- `scribe/` — scribe agent code and helpers
- `phoenix/` — Phoenix channel client implementation
- `resources/` — product notes, briefs and demo media (see resources/aimeet.md)
- `public/` — static assets (shaders, etc.)

### Typical local run flow

1. Start frontend: `npm run dev -- --host`.
2. Start agent helper(s): `npm run scribe:dev` and/or `npm run fact-checker:dev`.
3. Open the app URL reported by Vite (usually `http://localhost:5170`).
4. Join from multiple devices/tabs to test collaboration and agent panels.

### Troubleshooting

- Blank room or connection issues: verify `.env` values and Fishjam credentials.
- Devices not available: ensure camera/mic permissions and prefer HTTPS when required by the browser.
- Notes/fact-check panels not updating: confirm local agent services are running and `VITE_SCRIBE_SERVICE_URL` / `VITE_SCRIBE_NOTES_WS_URL` are correct.
