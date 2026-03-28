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
- `FISHJAM_ROOM_ID`: room id where the agent should join
- `FISHJAM_AGENT_SUBSCRIBE_MODE`: `auto` (default) or `manual`
- `PHOENIX_WS_URL`: Phoenix socket URL, for example `ws://localhost:4000/socket/websocket`
- `PHOENIX_TOPIC`: defaults to `scribe:global`
- `PHOENIX_EVENT`: defaults to `save_note_item`

## Run

1. Start the service:

```bash
pnpm scribe:dev
```

The service follows the FishJam agent tutorial flow:

1. create/connect an agent in `FISHJAM_ROOM_ID`
2. receive audio via `trackData`
3. forward audio chunks to Gemini Live `realtimeInput`
4. listen for `save_note_item` function calls
5. broadcast note payloads over Phoenix Channels