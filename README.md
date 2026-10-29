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

# Generate a video (Seedance 2.0 by default — any catalog video model works)
unsora video create --prompt "cinematic drone shot over mountains at sunset"
unsora video create -p "city at night" -m veo-3.1-fast --resolution 1080p --sound

# Browse every model and its inputs (live catalog), price a run, generate with any model
unsora models
unsora models seedance-2.5
unsora catalog quote -m seedance-2.5 -p "a fox in the snow" -i duration=10
unsora catalog generate -m seedance-2.5 -p "a fox in the snow" -i duration=10 --expected-credits 200

# Generate music
unsora music create --prompt "upbeat lo-fi beat" --lyrics "Verse one..."

# Turn a script into speech
unsora voiceover voices
unsora voiceover create --text "Welcome to Unsora." --voice Brian

# Clip a long video
unsora clip create --url "https://www.youtube.com/watch?v=..."

# Upload your own media
unsora upload ./demo.mp4

# Schedule a post to connected accounts (or publish right away with --now)
unsora accounts
unsora post create -c "New drop 🔥" -a <account-id> --video https://... --schedule 2026-08-05T10:00:00Z
unsora post create -c "Live now" -a <account-id> --video https://... --now --wait
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
| `unsora models [model] [--category <c>]` | List models from the live catalog, or one model's modes and inputs |
| `unsora catalog list/quote/generate` | Model-agnostic generation: price a run and generate with any video, image or motion-control model |
| `unsora open` | Print app/docs links |
| `unsora image create/list/get/status/delete` | Image generation (any catalog image model) |
| `unsora video create/list/status/delete` | Video generation (any catalog video model) |
| `unsora music create/list/get/status/delete` | Mureka music |
| `unsora voiceover voices/create/list/status/delete` | ElevenLabs Eleven v3 voiceovers |
| `unsora thumbnail create/list/get/status/delete` | YouTube-style thumbnails (16:9) |
| `unsora influencer create/list/status/delete` | AI influencer portraits |
| `unsora clip create/list/get/status/delete/delete-clip` | AI clipping |
| `unsora upload <file-or-url>` / `upload list/delete` | Upload media to your library |
| `unsora accounts [--platform <name>]` | List connected social accounts |
| `unsora accounts boards <account-id>` | Pinterest boards for an account |
| `unsora accounts tiktok-info <account-id>` | TikTok posting options (allowed privacy levels, limits) |
| `unsora post create/list/get/update/publish/retry/delete` | Social posts: drafts, scheduling, publishing |
| `unsora post analytics [--days n] [--refresh]` | Engagement summary across platforms |
| `unsora upgrade` | Update the CLI to the latest version |

Add `--json` to most commands for scripting. Add `--no-wait` on create commands to skip polling (`clip create`, `post publish` and `post retry` take `--wait` instead).

Completed generations are downloaded to the current directory by default (e.g. `unsora-image-<id>.png`). Use `-o <file>` to pick the path, `--no-save` to skip downloading, or `unsora image status <id> --save` to fetch a result later.

### Safe retries

Every create command accepts `--idempotency-key <key>`. Retrying with the same key within 24 hours replays the first response instead of starting (and charging for) a second job. `post create` also accepts `--external-id`, which the API uses as the key when no header is sent.

If the API answers `429` (60 requests per minute per key), the CLI waits for `Retry-After` and retries up to 3 times.

## Generating with any model

`unsora models` reads the live model catalog (`GET /catalog`), so new models show up without a CLI update. `unsora models <model>` lists the model's modes and every input it takes, with allowed values and defaults.

```bash
unsora models --category video
unsora models kling-o3-pro

# Simple shapes — common fields as flags
unsora video create -p "..." -m kling-o3-pro -r 9:16 -d 10 --resolution 1080p --sound
unsora video create -p "..." --start-image https://.../first.png --last-image https://.../last.png
unsora video create -p "..." -m seedance-2.0 --ref https://.../a.png --ref-video https://.../b.mp4
unsora image create -p "..." -m gpt-image-2 --resolution 2k --quality high --ref https://.../ref.png

# Full control — any input by its catalog key
unsora catalog quote -m seedance-2.5 -p "..." -i duration=10 -i resolution=1080p
unsora catalog generate -m seedance-2.5 -p "..." \
  -i reference_images=https://.../1.png -i reference_images=https://.../2.png \
  --expected-credits 200 --idempotency-key launch-teaser-1
```

`--input key=value` can be repeated; repeating a key builds a list. Values starting with `[` or `{` are parsed as JSON, and `--inputs '<json>'` passes all inputs at once. `--expected-credits` caps the spend: if the live price is higher, nothing is charged and the API answers `409 PRICE_CHANGED`. Media inputs must be hosted on Unsora — use `unsora upload` first for your own files.

## Clipping

```bash
unsora clip create -u "https://www.youtube.com/watch?v=..." \
  --limit 5 -d 30-60 -r 9:16 -q "funny reactions" \
  --captions --caption-style bold-white --source-lang en --wait

unsora clip get <clipping-id>                 # job + clip ids and URLs
unsora clip delete-clip <clipping-id> <clip-id>
```

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

Posts can target any connected account on **YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, Threads, Pinterest, X, or Google Business Profile** (connect accounts in the web app; requires a paid plan).

A post created without `--schedule` is saved as a **draft**. Publish it with `unsora post publish <id>`, or pass `--now` to `post create` to create and publish in one step. Add `--wait` to follow publishing to the end and see per-account results (the command exits non-zero unless every account published).

```bash
# See connected accounts (YouTube accounts show provider "google")
unsora accounts

# Post a video now and wait for the result
unsora post create -c "caption" -a <account-id> --video https://... --now --wait

# Save a draft, then publish it later
unsora post create -c "caption" -a <account-id> --image https://.../photo.png
unsora post publish <post-id> --wait

# Schedule a carousel to two accounts, with a different caption on one
unsora post create -c "caption" -a <id1> -a <id2> --account-caption <id2>="other caption" \
  --image https://.../1.png --image https://.../2.png \
  --schedule 2026-08-05T10:00:00Z --timezone Europe/London
```

One `--image` makes an IMAGE post, several make a carousel. `--video` makes a VIDEO post; add `--cover <url>` for the Instagram Reel cover. `--type` overrides the inferred type, and `--media-json` passes the raw `media` value (e.g. an array of `{type, url}` items).

### Platform options

```bash
# YouTube
unsora post create -c "description" -a <youtube-id> --video https://... \
  --title "Video title" --privacy unlisted --tag ai --tag shorts --category-id 28 --made-for-kids

# TikTok — check what the account allows first
unsora accounts tiktok-info <tiktok-id>
unsora post create -c "caption" -a <tiktok-id> --video https://... \
  --tiktok-privacy SELF_ONLY --tiktok-disable-duet --tiktok-ai-generated --tiktok-cover-ms 1500

# Pinterest
unsora accounts boards <pinterest-id>
unsora post create -c "caption" -a <pinterest-id> --image https://... \
  --board <board-id> --pin-title "Pin title" --pin-link https://example.com

# Google Business Profile call-to-action
unsora post create -c "Spring menu is here" -a <gbp-id> --image https://... \
  --cta ORDER --cta-url https://example.com/order
```

Other TikTok flags: `--tiktok-disable-comment`, `--tiktok-disable-stitch`, `--tiktok-brand-content`, `--tiktok-brand-organic`, `--tiktok-auto-music`, `--tiktok-post-mode`, `--tiktok-photo-cover`. Anything else goes in `--settings-json '{"tiktok":{...}}'`, which is merged over the flags.

### Managing posts and analytics

```bash
unsora post list --status SCHEDULED --type VIDEO
unsora post get <id>                       # per-account publish status + URLs
unsora post update <id> --schedule 2026-08-06T09:00:00Z
unsora post update <id> --unschedule       # back to draft
unsora post update <id> -a <id1> -a <id3>  # replace the account list
unsora post retry <id> --wait              # re-attempts only the failed accounts
unsora post delete <id>

unsora post analytics --days 30            # views, likes, comments, shares, saves by platform
unsora post analytics --refresh            # poll the platforms for fresh metrics first
```

## Models

Video, image and motion-control models come from the live catalog — run `unsora models` for the current list, or `unsora models --category video|image|motion-control`. Older names such as `veo`, `kling-pro`, `gpt-image-1.5` and `seedream-v5-lite` still resolve to their current models.

- **Music:** `auto`, `mureka-9`, `mureka-8`, `mureka-o2`, `mureka-7.6`, `mureka-7.5`

Upscalers and the rest of the studio are in the web app at **[app.tryunsora.com](https://app.tryunsora.com)**.

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
