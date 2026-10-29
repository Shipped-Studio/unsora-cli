import type { Command } from "commander";
import { UnsoraClient, type StatusData } from "../client.js";
import { PLATFORMS } from "../paths.js";
import { pollUntilDone } from "../poll.js";
import { exitWithError, formatTable, printJson } from "../output.js";
import { collect, IDEMPOTENCY_HELP, parseJsonOption } from "../options.js";

type AccountRow = {
  id?: string;
  provider?: string;
  accountName?: string;
  accountUsername?: string;
};

type PostAccount = {
  accountId?: string;
  published?: boolean;
  publishedUrl?: string | null;
  error?: string | null;
  account?: { provider?: string; accountName?: string | null; accountUsername?: string | null };
};

type PostRecord = {
  id?: string;
  status?: string;
  error?: string | null;
  postAccounts?: PostAccount[];
};

const POST_TERMINAL = ["PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED"];
const TIKTOK_PRIVACY = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
];
const GBP_CTA = ["LEARN_MORE", "BOOK", "ORDER", "SHOP", "SIGN_UP", "CALL"];
const POST_TYPES = ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"];

/** Poll GET /posts/{id} until publishing finishes. */
async function waitForPublish(client: UnsoraClient, id: string): Promise<PostRecord> {
  let latest: PostRecord = {};
  await pollUntilDone(
    client,
    async (i) => {
      const res = (await client.getPost(i)) as { data?: PostRecord };
      latest = res.data ?? {};
      return {
        id: i,
        status: String(latest.status ?? ""),
        error: latest.error ?? null,
      } satisfies StatusData;
    },
    id,
    {
      label: "Publishing",
      intervalMs: 5000,
      timeoutMs: 1_800_000,
      terminal: POST_TERMINAL,
      // Partial results are reported per account below, not thrown.
      success: ["PUBLISHED", "PARTIALLY_PUBLISHED"],
    },
  );
  return latest;
}

function printPostAccounts(post: PostRecord): void {
  const rows = post.postAccounts ?? [];
  if (!rows.length) return;
  formatTable([
    ["ACCOUNT", "PLATFORM", "PUBLISHED", "URL / ERROR"],
    ...rows.map((a) => [
      String(a.account?.accountUsername ?? a.account?.accountName ?? a.accountId ?? ""),
      String(a.account?.provider ?? ""),
      a.published ? "yes" : "no",
      String(a.publishedUrl ?? a.error ?? ""),
    ]),
  ]);
}

/** Print the outcome of a waited publish and set a failing exit code if needed. */
function reportPublish(post: PostRecord, json?: boolean): void {
  if (json) printJson(post);
  else {
    console.log(`Post ${post.id ?? ""} — ${post.status ?? ""}`);
    printPostAccounts(post);
  }
  if (post.status !== "PUBLISHED") process.exitCode = 1;
}

/** Drop undefined values; return undefined when nothing is left. */
function compact(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const out = Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
  return Object.keys(out).length ? out : undefined;
}

function int(name: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n)) exitWithError(`${name} must be a whole number`);
  return n;
}

export function registerSocialCommands(program: Command): void {
  // ─── accounts ──────────────────────────────────────────────────────────

  const accounts = program
    .command("accounts")
    .description(
      `Connected social accounts (${PLATFORMS.join(", ")})`,
    );

  accounts
    .command("list", { isDefault: true })
    .description("List connected social accounts")
    .option("--platform <name>", "Filter by platform/provider")
    .option("--json", "Output as JSON")
    .action(async (opts: { platform?: string; json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.getAccounts()) as { data?: AccountRow[] };
        let rows = data.data ?? [];
        if (opts.platform) {
          // YouTube accounts are stored with provider "google".
          const wanted = opts.platform.toLowerCase();
          const match = wanted === "youtube" ? "google" : wanted;
          rows = rows.filter(
            (a) => (a.provider ?? "").toLowerCase() === match,
          );
        }
        if (opts.json) {
          printJson(rows);
          return;
        }
        if (!rows.length) {
          console.log(
            "(no connected accounts — connect them in the Unsora app)",
          );
          return;
        }
        formatTable([
          ["ID", "PLATFORM", "NAME", "USERNAME"],
          ...rows.map((a) => [
            String(a.id ?? ""),
            String(a.provider ?? ""),
            String(a.accountName ?? ""),
            String(a.accountUsername ?? ""),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  accounts
    .command("boards <accountId>")
    .description("List a Pinterest account's boards (use the id with `post create --board`)")
    .option("--json", "Output as JSON")
    .action(async (accountId: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.getPinterestBoards(accountId)) as {
          data?: Array<{ id?: string; name?: string; privacy?: string }>;
        };
        if (opts.json) {
          printJson(data);
          return;
        }
        const boards = data.data ?? [];
        if (!boards.length) {
          console.log("(no boards)");
          return;
        }
        formatTable([
          ["ID", "NAME", "PRIVACY"],
          ...boards.map((b) => [
            String(b.id ?? ""),
            String(b.name ?? ""),
            String(b.privacy ?? ""),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  accounts
    .command("tiktok-info <accountId>")
    .description(
      "Show a TikTok account's posting options (privacy levels, max duration, …)",
    )
    .option("--json", "Output as JSON")
    .action(async (accountId: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getTikTokCreatorInfo(accountId);
        printJson(opts.json ? data : (data as { data?: unknown }).data ?? data);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  // ─── posts ─────────────────────────────────────────────────────────────

  const post = program
    .command("post")
    .description(
      `Schedule social posts to connected accounts (${PLATFORMS.join(", ")})`,
    );

  post
    .command("create")
    .description(
      "Create a draft, schedule a post, or publish now with --now (requires paid plan)",
    )
    .requiredOption("-c, --caption <text>", "Post caption")
    .requiredOption(
      "-a, --account <id>",
      "Account id (repeatable, 1–10 — see `unsora accounts`)",
      collect,
      [],
    )
    .option(
      "--account-caption <id=text>",
      "Caption for one account only (repeatable)",
      collect,
      [],
    )
    .option("--video <url>", "Video URL to post")
    .option("--cover <url>", "Video cover image URL (Instagram Reel cover)")
    .option(
      "--image <url>",
      "Image URL (repeatable — one image = IMAGE post, several = carousel)",
      collect,
      [],
    )
    .option("--media-json <json>", "Raw `media` value (object or array of {type, url, …})")
    .option("--type <type>", `Override the post type (${POST_TYPES.join(", ")})`)
    .option(
      "--schedule <iso>",
      "ISO datetime to schedule (≥2 min ahead); omit to save a draft",
    )
    .option("--now", "Publish immediately after creating")
    .option("--wait", "With --now, wait until publishing finishes")
    .option("--timezone <tz>", "IANA timezone for the schedule")
    // YouTube
    .option("--title <text>", "Video title (YouTube; also the Pinterest pin title)")
    .option("--privacy <status>", "YouTube privacy: public, private, unlisted")
    .option("--tag <tag>", "YouTube tag (repeatable)", collect, [])
    .option("--category-id <id>", "YouTube category id (default 22, People & Blogs)")
    .option("--made-for-kids", "YouTube: mark the video as made for kids")
    // TikTok
    .option("--tiktok-privacy <level>", `TikTok privacy: ${TIKTOK_PRIVACY.join(", ")}`)
    .option("--tiktok-disable-comment", "TikTok: turn off comments")
    .option("--tiktok-disable-duet", "TikTok: turn off duets (video)")
    .option("--tiktok-disable-stitch", "TikTok: turn off stitches (video)")
    .option("--tiktok-brand-content", "TikTok: disclose a paid partnership")
    .option("--tiktok-brand-organic", "TikTok: disclose promotion of your own business")
    .option("--tiktok-ai-generated", "TikTok: label as AI-generated content")
    .option("--tiktok-auto-music", "TikTok: let TikTok add music (photo posts)")
    .option(
      "--tiktok-post-mode <mode>",
      "TikTok photo posts: DIRECT_POST or MEDIA_UPLOAD (send to TikTok inbox)",
    )
    .option("--tiktok-photo-cover <index>", "TikTok photo posts: zero-based cover image index")
    .option("--tiktok-cover-ms <ms>", "TikTok video posts: cover frame timestamp in ms")
    // Pinterest
    .option("--board <id>", "Pinterest board id (see `unsora accounts boards <id>`)")
    .option("--pin-title <text>", "Pinterest pin title (max 100 chars)")
    .option("--pin-link <url>", "Pinterest destination link")
    // Google Business Profile
    .option("--cta <type>", `Google Business button: ${GBP_CTA.join(", ")}`)
    .option("--cta-url <url>", "Google Business button link (not used with CALL)")
    // Escape hatch + idempotency
    .option(
      "--settings-json <json>",
      "Raw per-platform `settings` object, merged over the flags above",
    )
    .option(
      "--external-id <id>",
      "Your own id for this request (idempotency alias when no --idempotency-key)",
    )
    .option("--idempotency-key <key>", IDEMPOTENCY_HELP)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (opts.video && opts.image?.length) {
        exitWithError("Use either --video or --image, not both");
      }
      if (opts.mediaJson && (opts.video || opts.image?.length)) {
        exitWithError("Use --media-json on its own, without --video or --image");
      }
      if (opts.schedule && opts.now) {
        exitWithError("Use either --schedule or --now, not both");
      }
      if (opts.cover && !opts.video) {
        exitWithError("--cover needs --video");
      }

      const client = new UnsoraClient();
      try {
        const custom = new Map<string, string>();
        for (const pair of opts.accountCaption as string[]) {
          const eq = pair.indexOf("=");
          if (eq <= 0) {
            exitWithError(`--account-caption expects <id>=<text>, got "${pair}"`);
          }
          custom.set(pair.slice(0, eq), pair.slice(eq + 1));
        }
        for (const id of custom.keys()) {
          if (!(opts.account as string[]).includes(id)) {
            exitWithError(`--account-caption id ${id} is not in --account`);
          }
        }

        const accountList = (opts.account as string[]).map((id) => ({
          id,
          ...(custom.has(id) ? { customCaption: custom.get(id) } : {}),
          ...(opts.title ? { title: opts.title } : {}),
        }));
        const body: Record<string, unknown> = {
          caption: opts.caption,
          accounts: accountList,
        };

        if (opts.mediaJson) {
          body.media = parseJsonOption("--media-json", opts.mediaJson);
        } else if (opts.video) {
          body.media = {
            type: "video",
            url: opts.video,
            ...(opts.cover ? { cover_url: opts.cover } : {}),
          };
        } else if (opts.image?.length === 1) {
          body.media = [{ type: "IMAGE", url: opts.image[0] }];
        } else if (opts.image?.length) {
          body.media = { type: "slideshow", urls: opts.image };
        }
        if (opts.type) {
          const type = String(opts.type).toUpperCase();
          if (!POST_TYPES.includes(type)) {
            exitWithError(`--type must be one of: ${POST_TYPES.join(", ")}`);
          }
          body.type = type;
        }
        if (opts.schedule) body.scheduled_at = opts.schedule;
        if (opts.timezone) body.timezone = opts.timezone;
        if (opts.externalId) body.external_id = opts.externalId;

        const settings: Record<string, unknown> = {};
        const youtube = compact({
          privacyStatus: opts.privacy,
          tags: opts.tag?.length ? opts.tag : undefined,
          categoryId: opts.categoryId,
          madeForKids: opts.madeForKids ? true : undefined,
        });
        if (youtube) settings.youtube = youtube;

        const tiktok = compact({
          privacy_level: opts.tiktokPrivacy,
          disable_comment: opts.tiktokDisableComment ? true : undefined,
          disable_duet: opts.tiktokDisableDuet ? true : undefined,
          disable_stitch: opts.tiktokDisableStitch ? true : undefined,
          brand_content_toggle: opts.tiktokBrandContent ? true : undefined,
          brand_organic_toggle: opts.tiktokBrandOrganic ? true : undefined,
          is_aigc: opts.tiktokAiGenerated ? true : undefined,
          auto_add_music: opts.tiktokAutoMusic ? true : undefined,
          post_mode: opts.tiktokPostMode,
          photo_cover_index: int("--tiktok-photo-cover", opts.tiktokPhotoCover),
          video_cover_timestamp_ms: int("--tiktok-cover-ms", opts.tiktokCoverMs),
        });
        if (tiktok) settings.tiktok = tiktok;

        const pinTitle = opts.pinTitle ?? opts.title;
        const pinterest = compact({
          board_id: opts.board,
          title: pinTitle ? String(pinTitle).slice(0, 100) : undefined,
          link: opts.pinLink,
        });
        if (pinterest) settings.pinterest = pinterest;

        if (opts.ctaUrl && !opts.cta) exitWithError("--cta-url needs --cta");
        const googleBusiness = compact({
          cta_type: opts.cta ? String(opts.cta).toUpperCase() : undefined,
          cta_url: opts.ctaUrl,
        });
        if (googleBusiness) settings.google_business = googleBusiness;

        if (opts.settingsJson) {
          const raw = parseJsonOption("--settings-json", opts.settingsJson);
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            exitWithError("--settings-json must be a JSON object");
          }
          for (const [platform, value] of Object.entries(raw as Record<string, unknown>)) {
            const prev = settings[platform];
            settings[platform] =
              prev && typeof prev === "object" && value && typeof value === "object"
                ? { ...prev, ...value }
                : value;
          }
        }
        if (Object.keys(settings).length) body.settings = settings;

        const data = await client.createPost(body, {
          idempotencyKey: opts.idempotencyKey,
        });
        const root = data as { data?: { id?: string; status?: string } };
        const id = root.data?.id;

        if (!opts.now || !id) {
          if (opts.json) printJson(data);
          else {
            const status = root.data?.status ?? "created";
            console.log(`✓ Post ${id ?? "(unknown id)"} — ${status}`);
          }
          return;
        }

        const started = await client.publishPost(id);
        if (!opts.wait) {
          if (opts.json) printJson({ post: data, publish: started });
          else console.log(`✓ Post ${id} — publishing`);
          return;
        }
        reportPublish(await waitForPublish(client, id), opts.json);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("list")
    .description("List posts")
    .option(
      "--status <status>",
      "Filter: DRAFT, SCHEDULED, PUBLISHING, PUBLISHED, PARTIALLY_PUBLISHED, FAILED",
    )
    .option("--type <type>", `Filter by type: ${POST_TYPES.join(", ")}`)
    .option("--page <n>", "Page", "1")
    .option("--limit <n>", "Posts per page (1–100)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.listPosts({
          status: opts.status,
          type: opts.type ? String(opts.type).toUpperCase() : undefined,
          page: Number(opts.page),
          limit: opts.limit ? Number(opts.limit) : undefined,
        })) as {
          data?: { posts?: Array<Record<string, unknown>> };
        };
        if (opts.json) {
          printJson(data);
          return;
        }
        const posts = data.data?.posts;
        if (!posts?.length) {
          console.log("(no posts)");
          return;
        }
        formatTable([
          ["ID", "STATUS", "TYPE", "SCHEDULED", "CAPTION"],
          ...posts.map((p) => [
            String(p.id ?? ""),
            String(p.status ?? ""),
            String(p.type ?? ""),
            p.scheduledFor ? String(p.scheduledFor) : "-",
            String(p.mainCaption ?? "").slice(0, 40),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("get <id>")
    .description("Show one post with per-account publish status")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getPost(id);
        printJson(opts.json ? data : (data as { data?: unknown }).data ?? data);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("update <id>")
    .description("Edit a draft/scheduled post (published posts can't be edited)")
    .option("-c, --caption <text>", "New caption")
    .option("--schedule <iso>", "New ISO schedule datetime")
    .option("--unschedule", "Convert back to a draft")
    .option("--timezone <tz>", "IANA timezone for the schedule")
    .option(
      "-a, --account <id>",
      "Replace the account list (repeatable; published accounts are kept)",
      collect,
      [],
    )
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      if (opts.schedule && opts.unschedule) {
        exitWithError("Use either --schedule or --unschedule, not both");
      }
      const body: Record<string, unknown> = {};
      if (opts.caption) body.mainCaption = opts.caption;
      if (opts.schedule) body.scheduledFor = opts.schedule;
      if (opts.unschedule) body.scheduledFor = null;
      if (opts.timezone) body.timezone = opts.timezone;
      if (opts.account?.length) {
        body.accounts = (opts.account as string[]).map((accountId) => ({
          accountId,
        }));
      }
      if (!Object.keys(body).length) {
        exitWithError(
          "Nothing to update — pass --caption, --schedule, --unschedule, or --account",
        );
      }

      const client = new UnsoraClient();
      try {
        const data = await client.updatePost(id, body);
        if (opts.json) printJson(data);
        else console.log(`✓ Updated ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("publish <id>")
    .description(
      "Publish a DRAFT, SCHEDULED, FAILED or PARTIALLY_PUBLISHED post now",
    )
    .option("--wait", "Wait until publishing finishes and show per-account results")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; wait?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.publishPost(id);
        if (!opts.wait) {
          if (opts.json) printJson(data);
          else {
            const root = data as { message?: string };
            console.log(`✓ ${root.message ?? "Publishing started"} — ${id}`);
          }
          return;
        }
        reportPublish(await waitForPublish(client, id), opts.json);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("retry <id>")
    .description(
      "Retry a FAILED or PARTIALLY_PUBLISHED post (only failed accounts re-attempt)",
    )
    .option("--wait", "Wait until publishing finishes and show per-account results")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; wait?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.retryPost(id);
        if (!opts.wait) {
          if (opts.json) printJson(data);
          else {
            const root = data as { message?: string };
            console.log(root.message ?? `✓ Retried ${id}`);
          }
          return;
        }
        reportPublish(await waitForPublish(client, id), opts.json);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("delete <id>")
    .description("Delete a post (does not remove already-published content)")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deletePost(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("analytics")
    .description("Engagement summary for posts published in the last N days")
    .option("--days <n>", "Window in days (7–90)", "30")
    .option("--refresh", "Poll the platforms for fresh metrics first")
    .option("--json", "Output as JSON")
    .action(async (opts: { days: string; refresh?: boolean; json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        let refreshed: number | undefined;
        if (opts.refresh) {
          const r = (await client.refreshPostAnalytics()) as {
            data?: { refreshed?: number };
          };
          refreshed = r.data?.refreshed;
        }
        const data = (await client.getPostAnalytics(Number(opts.days))) as {
          data?: {
            days?: number;
            postCount?: number;
            totals?: Record<string, number>;
            byPlatform?: Array<Record<string, unknown>>;
          };
        };
        if (opts.json) {
          printJson(refreshed === undefined ? data : { ...data, refreshed });
          return;
        }
        const d = data.data ?? {};
        if (refreshed !== undefined) {
          console.log(`Refreshed metrics for ${refreshed} post(s)\n`);
        }
        const t = d.totals ?? {};
        console.log(
          `Last ${d.days ?? opts.days} days — ${d.postCount ?? 0} post(s)`,
        );
        console.log(
          `Views ${t.views ?? 0} · Likes ${t.likes ?? 0} · Comments ${t.comments ?? 0} · Shares ${t.shares ?? 0} · Saves ${t.saves ?? 0}`,
        );
        const rows = d.byPlatform ?? [];
        if (rows.length) {
          console.log("");
          formatTable([
            ["PLATFORM", "POSTS", "VIEWS", "LIKES", "COMMENTS", "SHARES", "SAVES"],
            ...rows.map((r) => [
              String(r.platform ?? ""),
              String(r.posts ?? 0),
              String(r.views ?? 0),
              String(r.likes ?? 0),
              String(r.comments ?? 0),
              String(r.shares ?? 0),
              String(r.saves ?? 0),
            ]),
          ]);
        }
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
