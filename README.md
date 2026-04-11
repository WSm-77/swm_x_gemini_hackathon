# Fishjam Chat

A modern conferencing frontend built with React, Vite, Tailwind, and
`@fishjam-cloud/react-client`.

This project includes:

- room join and role selection flow,
- camera/microphone controls,
- screen sharing layout (spotlight + top bar pagination),
- side panel (user notes, AI notes),
- optional real-time background blur using MediaPipe + Web Worker.

## Requirements

- Node.js 20+
- npm or pnpm
- a Fishjam room manager backend and project credentials

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Set your environment variables in `.env`:

```bash
VITE_FISHJAM_ID=<your_fishjam_id>
GEMINI_API_KEY=<your_gemini_api_key>
FISHJAM_MANAGEMENT_TOKEN=<your_fishjam_management_token>
FISHJAM_ID=<your_fishjam_id>
VITE_SCRIBE_SERVICE_URL=http://localhost:8787 # URL of the Scribe backend service
VITE_SCRIBE_NOTES_WS_URL=ws://localhost:8787/ws/notes # WebSocket URL for receiving real-time updates of notes

```

4. Run locally:

```bash
npm run dev -- --host

# or with pnpm
pnpm dev --host
```

5. Open the provided URL (usually `http://localhost:5170`).

6. Start scribing agent in another terminal:

```bash
set -a && source .env && set +a && pnpm scribe:dev
```

7. Join the room from multiple devices and test the experience!

8. After leaving the room delete all rooms with script

```bash
bun clear.ts
```

## Troubleshooting

- Blank room or connection issues:
	- verify `.env` values,
	- verify your room manager backend URL/configuration,
	- check browser console/network tab for Fishjam API errors.
- Devices not available:
	- ensure camera/mic permissions are granted,
	- use HTTPS when required by browser policy.

## References

- Fishjam React quick start:
	https://fishjam.swmansion.com/docs/0.24.0/tutorials/react-quick-start
- Smelter getting started:
	https://smelter.dev/fundamentals/getting-started
