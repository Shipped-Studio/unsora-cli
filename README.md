# Unsora CLI

Official command-line interface for [Unsora](https://app.tryunsora.com) — generate AI video, images, music, and clips from your terminal.

## Quick start

```bash
# Install
npm install -g unsora-cli

# Authenticate (get key from app.tryunsora.com → Settings → API Keys)
unsora auth login

# Check credits
unsora credits

# Generate an image
unsora image create --prompt "product photo of sneakers on white background"

# Generate a Seedance 2.0 video
unsora video create --prompt "cinematic drone shot over mountains at sunset"

# Generate music
unsora music create --prompt "upbeat lo-fi beat" --lyrics "Verse one..."

# Clip a long video
unsora clip create --url "https://www.youtube.com/watch?v=..."
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `UNSORA_API_KEY` | API key (`uns_live_…` or `uns_test_…`) — overrides saved config |
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
| `unsora clip create/list/get/status/delete` | AI clipping |

Add `--json` to most commands for scripting. Add `--no-wait` on create commands to skip polling.

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

## Development

```bash
npm install
npm run dev -- credits          # run via tsx
npm run build                   # compile to dist/
node dist/index.js --help
```

## License

MIT
