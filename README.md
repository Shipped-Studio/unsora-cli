# Unsora CLI

Official command-line interface for [Unsora](https://tryunsora.com) — generate AI video, images, music, voiceovers, thumbnails, and clips, upload media, and schedule social posts from your terminal.

## Quick start

```bash
# Install
npm install -g unsora-cli

# Authenticate (get key from app.tryunsora.com → Settings → API Keys)
unsora auth login

# Check credits
unsora credits

# Generate an image (saved to the current directory when done)
unsora image create --prompt "product photo of sneakers on white background"

# Generate a Seedance 2.0 video
unsora video create --prompt "cinematic drone shot over mountains at sunset"

# Generate music
unsora music create --prompt "upbeat lo-fi beat" --lyrics "Verse one..."

# Turn a script into speech
unsora voiceover voices
unsora voiceover create --text "Welcome to Unsora." --voice Brian

# Clip a long video
unsora clip create --url "https://www.youtube.com/watch?v=..."

# Upload your own media
unsora upload ./demo.mp4

# Schedule a post to connected accounts
unsora accounts
unsora post create -c "New drop 🔥" -a <account-id> --video https://... --schedule 2026-08-05T10:00:00Z
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `UNSORA_API_KEY` | API key (`uns_…`) — overrides saved config |
| `UNSORA_API_URL` | API base URL (default: `https://mvp.tryunsora.com/api/v1`) |

## Commands

| Command | Description |
|---------|-------------|
| `unsora auth login` | Save API key |
| `unsora auth logout` | Remove saved key |
| `unsora auth whoami` | Credits + subscription |
| `unsora credits` | Credit balance |
| `unsora config get/set` | Manage config |
| `unsora models [--all]` | List available models |
| `unsora open` | Print app/docs links |
| `unsora image create/list/status/delete` | Image generation |
| `unsora video create/list/status/delete` | Seedance 2.0 video |
| `unsora music create/list/status/delete` | Mureka music |
| `unsora voiceover voices/create/list/status/delete` | ElevenLabs Eleven v3 voiceovers |
| `unsora thumbnail create/list/status/delete` | YouTube-style thumbnails (16:9) |
| `unsora influencer create/list/status/delete` | AI influencer portraits |
| `unsora clip create/list/get/status/delete` | AI clipping |
| `unsora upload <file-or-url>` / `upload list/delete` | Upload media to your library |
| `unsora accounts [--platform <name>]` | List connected social accounts |
| `unsora post create/list/get/update/retry/delete` | Schedule social posts |
| `unsora upgrade` | Update the CLI to the latest version |

Add `--json` to most commands for scripting. Add `--no-wait` on create commands to skip polling.

Completed generations are downloaded to the current directory by default (e.g. `unsora-image-<id>.png`). Use `-o <file>` to pick the path, `--no-save` to skip downloading, or `unsora image status <id> --save` to fetch a result later.

## Uploading media

`unsora upload` puts your own files into your Unsora media library and prints the hosted URL, which you can use anywhere a media URL is accepted (post media, reference images, clipping input). Every upload is recorded as an asset in your library.

```bash
# Import a public URL (server-side fetch, max 200MB)
unsora upload https://example.com/video.mp4

# Upload a local file
unsora upload ./photo.png

# Manage uploads
unsora upload list
unsora upload delete <asset-id>
```

Local files use the **signed-URL flow** under the hood — the CLI mints a short-lived direct-upload URL (`POST /uploads/signed-url`), PUTs the file bytes straight to storage (they never pass through the API server), then registers the asset (`POST /uploads/complete`). This is also the flow to use for large files when calling the API directly; small files can go through `POST /uploads` with a `url` or `base64` body instead. See the [API docs](https://tryunsora.com/docs) for details.

## Social posting

Posts can target any connected account on **YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, Threads, or Pinterest** (connect accounts in the web app; requires a paid plan).

```bash
# See connected accounts (YouTube accounts show provider "google")
unsora accounts

# Post a video now
unsora post create -c "caption" -a <account-id> --video https://...

# Schedule a slideshow to two accounts
unsora post create -c "caption" -a <id1> -a <id2> \
  --image https://.../1.png --image https://.../2.png \
  --schedule 2026-08-05T10:00:00Z --timezone Europe/London

# Platform extras
unsora post create -c "caption" -a <youtube-account-id> --video https://... \
  --title "Video title" --privacy unlisted --tag ai --tag shorts
unsora post create -c "caption" -a <pinterest-account-id> --image https://... \
  --title "Pin title" --board <board-id>

# Manage posts
unsora post list --status SCHEDULED
unsora post retry <id>       # re-attempts only the failed accounts
```

## Models

### CLI + Public API

- **Image:** `nano-banana-2`, `nano-banana-pro`, `seedream-v5-lite`, `gpt-image-1.5`, `gpt-image-2`
- **Video:** `seedance-2.0` (Seedance 2.0)
- **Music:** `auto`, `mureka-9`, `mureka-8`, `mureka-o2`, `mureka-7.6`, `mureka-7.5`

### All Wavespeed models (web app)

Kling, Veo, Sora, Wan, motion control, upscalers, and more are available at **[app.tryunsora.com](https://app.tryunsora.com)**.

```bash
unsora models --all
```

## Links

| Resource | URL |
|----------|-----|
| **App (try all models)** | https://app.tryunsora.com |
| **Website** | https://tryunsora.com |
| **DOCS** | https://tryunsora.com/docs |
| **MCP (Claude/Cursor)** | https://mcp.tryunsora.com/mcp |
| **GitHub** | https://github.com/Shipped-Studio/unsora-cli |

## Development

```bash
npm install
npm run dev -- credits          # run via tsx
npm run build                   # compile to dist/
node dist/index.js --help
```

## License

MIT
