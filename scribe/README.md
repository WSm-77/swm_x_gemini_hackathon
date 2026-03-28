# Scribe Service

Server-side TypeScript service that joins FishJam as an Agent (using the server SDK),
streams incoming 16-bit 16kHz PCM audio to Gemini Live, then broadcasts tool-call
note items to Phoenix.

## File Structure

- `scribe/src/index.ts`: service entrypoint and bridge orchestration
- `scribe/src/config.ts`: environment configuration
- `scribe/src/schemas/saveNoteItemSchema.ts`: JSON schema for `save_note_item`
- `scribe/src/fishjam/FishjamAgentPcmSource.ts`: FishJam Agent connection and `trackData` PCM source
- `scribe/src/gemini/GeminiLiveClient.ts`: Gemini Live websocket client
- `scribe/src/phoenix/PhoenixChannelClient.ts`: Phoenix Channels publisher
- `scribe/src/types.ts`: shared note/tool-call types

## Expected Environment Variables

- `GEMINI_API_KEY`: Gemini API key
- `GEMINI_MODEL`: defaults to `gemini-3.1-flash-live-preview`
- `GEMINI_LIVE_WS_URL`: base endpoint for BidiGenerateContent websocket
- `FISHJAM_ID`: FishJam app id
- `FISHJAM_MANAGEMENT_TOKEN`: FishJam management token
- `FISHJAM_AGENT_SUBSCRIBE_MODE`: `auto` (default) or `manual`
- `PHOENIX_TOPIC`: defaults to `scribe:global`
- `PHOENIX_EVENT`: defaults to `save_note_item`
- `SCRIBE_CONTROL_HOST`: defaults to `0.0.0.0`
- `SCRIBE_CONTROL_PORT`: defaults to `8787`

## Run

1. Start the service:

```bash
pnpm scribe:dev
```

The service follows the FishJam agent tutorial flow:

2. receive audio via `trackData`
3. forward audio chunks to Gemini Live `realtimeInput`
4. listen for `save_note_item` function calls
5. broadcast note payloads over Phoenix Channels

## Control API

The service now exposes a control API so the app can spin up a fresh agent per meeting.

- `GET /health`: service status + currently active sessions
- `POST /sessions/join`: discover all rooms in FishJam and start agents only for rooms not yet joined by scribe
- `POST /sessions/leave`: stop all active sessions

Example payload for `POST /sessions/join`:

```json
{}
```

`POST /sessions/join` is idempotent for already joined rooms: it skips existing sessions and only starts new ones.

## Notes WebSocket

The service also exposes a custom WebSocket endpoint for live AI notes text updates:

- `ws://<SCRIBE_CONTROL_HOST>:<SCRIBE_CONTROL_PORT>/ws/notes`

Message format sent to clients:

```json
{
	"type": "ai_note_text",
	"roomId": "<fishjam-room-id>",
	"text": "<latest text chunk from onModelText>",
	"timestamp": "<ISO datetime>"
}
```