import { getConfig } from "./config.js";
import { DEFAULT_BASE_URL, PATHS } from "./paths.js";

export interface ApiErrorBody {
  success?: boolean;
  error?: string;
  message?: string;
  code?: string;
}

export interface StatusData {
  id: string;
  status: string;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
}

/** Per-request extras for create endpoints. */
export interface CreateOptions {
  /** Sent as the `Idempotency-Key` header (max 128 chars, replayed for 24h). */
  idempotencyKey?: string;
}

/** How many times a rate-limited (429) request is retried before failing. */
const MAX_RATE_LIMIT_RETRIES = 3;
/** Upper bound for a single Retry-After wait. */
const MAX_RETRY_WAIT_MS = 60_000;

export class UnsoraClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts?: { baseUrl?: string; apiKey?: string }) {
    const cfg = getConfig();
    this.baseUrl = (opts?.baseUrl ?? cfg.baseUrl ?? DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    );
    this.apiKey = opts?.apiKey ?? cfg.apiKey ?? "";
  }

  requireApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        "No API key found. Run `unsora auth login` or set UNSORA_API_KEY.",
      );
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T = unknown>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    this.requireApiKey();

    const url = `${this.baseUrl}${path}`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...options.headers,
        },
      });

      // Rate limited: nothing was processed, so retrying is safe (create
      // calls can additionally carry an Idempotency-Key).
      if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const waitMs = retryDelayMs(res.headers.get("retry-after"), attempt);
        await res.body?.cancel().catch(() => {});
        process.stderr.write(
          `Rate limited — retrying in ${Math.ceil(waitMs / 1000)}s…\n`,
        );
        await sleep(waitMs);
        continue;
      }

      const body = (await res.json().catch(() => ({}))) as T & ApiErrorBody;

      if (!res.ok) {
        const msg =
          body.error ??
          body.message ??
          `HTTP ${res.status} ${res.statusText}`;
        throw new Error(body.code ? `${msg} (${body.code})` : msg);
      }

      return body;
    }
  }

  private post<T = unknown>(
    path: string,
    body?: unknown,
    opts: CreateOptions = {},
  ): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(opts.idempotencyKey
        ? { headers: { "Idempotency-Key": opts.idempotencyKey } }
        : {}),
    });
  }

  async getCredits(): Promise<{ credits: number }> {
    return this.request(PATHS.credits);
  }

  async getSubscription(): Promise<unknown> {
    return this.request(PATHS.subscription);
  }

  // ─── Catalog (model-agnostic generation) ───────────────────────────────

  async getCatalog(category?: string) {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.request(`${PATHS.catalog}${q}`);
  }

  async quoteCatalog(body: Record<string, unknown>) {
    return this.post(PATHS.catalogQuote, body);
  }

  async generateCatalog(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.catalogGenerate, body, opts);
  }

  // ─── Images ────────────────────────────────────────────────────────────

  async createImage(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.imageCreate, body, opts);
  }

  async listImages(page = 1, limit = 12) {
    return this.request(`${PATHS.imageList}?page=${page}&limit=${limit}`);
  }

  async getImage(id: string) {
    return this.request(PATHS.imageGet(id));
  }

  async getImageStatus(id: string): Promise<StatusData> {
    const res = await this.request<{ data: StatusData }>(
      PATHS.imageStatus(id),
    );
    return res.data;
  }

  async deleteImage(id: string) {
    return this.request(PATHS.imageDelete(id), { method: "DELETE" });
  }

  // ─── Videos ────────────────────────────────────────────────────────────

  async createVideo(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.videoCreate, body, opts);
  }

  async listVideos(page = 1, limit = 12, model?: string) {
    const m = model ? `&model=${encodeURIComponent(model)}` : "";
    return this.request(`${PATHS.videoList}?page=${page}&limit=${limit}${m}`);
  }

  async getVideoStatus(id: string): Promise<StatusData> {
    const res = await this.request<{ data: StatusData }>(
      PATHS.videoStatus(id),
    );
    return res.data;
  }

  async deleteVideo(id: string) {
    return this.request(PATHS.videoDelete(id), { method: "DELETE" });
  }

  // ─── Music ─────────────────────────────────────────────────────────────

  async createMusic(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.musicCreate, body, opts);
  }

  async listMusic(page = 1, limit = 12) {
    return this.request(`${PATHS.musicList}?page=${page}&limit=${limit}`);
  }

  async getMusic(id: string) {
    return this.request(PATHS.musicGet(id));
  }

  async getMusicStatus(id: string): Promise<StatusData> {
    const res = await this.request<{ data: StatusData }>(
      PATHS.musicStatus(id),
    );
    return res.data;
  }

  async deleteMusic(id: string) {
    return this.request(PATHS.musicDelete(id), { method: "DELETE" });
  }

  // ─── Clipping ──────────────────────────────────────────────────────────

  async createClip(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.clipCreate, body, opts);
  }

  async listClips() {
    return this.request(PATHS.clipList);
  }

  async getClip(id: string) {
    return this.request(PATHS.clipGet(id));
  }

  async getClipStatus(id: string) {
    return this.request(PATHS.clipStatus(id));
  }

  async deleteClip(id: string) {
    return this.request(PATHS.clipDelete(id), { method: "DELETE" });
  }

  async deleteClipItem(id: string, clipId: string) {
    return this.request(PATHS.clipItemDelete(id, clipId), {
      method: "DELETE",
    });
  }

  // ─── Voiceovers ────────────────────────────────────────────────────────

  async listVoiceoverVoices() {
    return this.request(PATHS.voiceoverVoices);
  }

  async createVoiceover(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.voiceoverCreate, body, opts);
  }

  async listVoiceovers(page = 1, limit = 12) {
    return this.request(`${PATHS.voiceoverList}?page=${page}&limit=${limit}`);
  }

  async getVoiceoverStatus(id: string): Promise<StatusData> {
    const res = await this.request<{ data: StatusData }>(
      PATHS.voiceoverStatus(id),
    );
    return res.data;
  }

  async deleteVoiceover(id: string) {
    return this.request(PATHS.voiceoverDelete(id), { method: "DELETE" });
  }

  // ─── Thumbnails ────────────────────────────────────────────────────────

  async createThumbnail(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.thumbnailCreate, body, opts);
  }

  async listThumbnails(page = 1, limit = 12) {
    return this.request(`${PATHS.thumbnailList}?page=${page}&limit=${limit}`);
  }

  async getThumbnail(id: string) {
    return this.request(PATHS.thumbnailGet(id));
  }

  async deleteThumbnail(id: string) {
    return this.request(PATHS.thumbnailDelete(id), { method: "DELETE" });
  }

  // ─── Influencer studio ─────────────────────────────────────────────────

  async createInfluencer(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.influencerCreate, body, opts);
  }

  async listInfluencers(page = 1, limit = 12) {
    return this.request(`${PATHS.influencerList}?page=${page}&limit=${limit}`);
  }

  async deleteInfluencer(id: string) {
    return this.request(PATHS.influencerDelete(id), { method: "DELETE" });
  }

  // ─── Uploads ───────────────────────────────────────────────────────────

  async uploadFromUrl(body: Record<string, unknown>) {
    return this.post(PATHS.uploads, body);
  }

  async createUploadSignedUrl(fileName: string) {
    return this.post(PATHS.uploadSignedUrl, { fileName });
  }

  async completeUpload(blobName: string, fileName?: string) {
    return this.post(PATHS.uploadComplete, { blobName, fileName });
  }

  async listUploads(page = 1, limit = 12) {
    return this.request(`${PATHS.uploads}?page=${page}&limit=${limit}`);
  }

  async deleteUpload(id: string) {
    return this.request(PATHS.uploadDelete(id), { method: "DELETE" });
  }

  // ─── Social accounts & posts ───────────────────────────────────────────

  async getAccounts() {
    return this.request(PATHS.accounts);
  }

  async getPinterestBoards(accountId: string) {
    return this.request(PATHS.pinterestBoards(accountId));
  }

  async getTikTokCreatorInfo(accountId: string) {
    return this.request(PATHS.tiktokCreatorInfo(accountId));
  }

  async createPost(body: Record<string, unknown>, opts?: CreateOptions) {
    return this.post(PATHS.posts, body, opts);
  }

  async listPosts(
    params: { status?: string; type?: string; page?: number; limit?: number } = {},
  ) {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.type) q.set("type", params.type);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    const query = q.toString();
    return this.request(`${PATHS.posts}${query ? `?${query}` : ""}`);
  }

  async getPost(id: string) {
    return this.request(PATHS.postGet(id));
  }

  async updatePost(id: string, body: Record<string, unknown>) {
    return this.request(PATHS.postUpdate(id), {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async publishPost(id: string) {
    return this.post(PATHS.postPublish(id));
  }

  async retryPost(id: string) {
    return this.post(PATHS.postRetry(id));
  }

  async deletePost(id: string) {
    return this.request(PATHS.postDelete(id), { method: "DELETE" });
  }

  async getPostAnalytics(days?: number) {
    const q = days ? `?days=${days}` : "";
    return this.request(`${PATHS.postAnalyticsSummary}${q}`);
  }

  async refreshPostAnalytics() {
    return this.post(PATHS.postAnalyticsRefresh);
  }
}

/**
 * Delay before retrying a 429. Honors `Retry-After` (seconds or HTTP date);
 * otherwise backs off 5s, 10s, 20s.
 */
function retryDelayMs(header: string | null, attempt: number): number {
  let ms = NaN;
  if (header) {
    const secs = Number(header);
    ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(header) - Date.now();
  }
  if (!Number.isFinite(ms) || ms < 0) ms = 5000 * 2 ** attempt;
  return Math.min(Math.max(ms, 1000), MAX_RETRY_WAIT_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
