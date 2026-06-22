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
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    const body = (await res.json().catch(() => ({}))) as T & ApiErrorBody;

    if (!res.ok) {
      const msg =
        body.error ??
        body.message ??
        `HTTP ${res.status} ${res.statusText}`;
      throw new Error(msg);
    }

    return body;
  }

  async getCredits(): Promise<{ credits: number }> {
    return this.request(PATHS.credits);
  }

  async getSubscription(): Promise<unknown> {
    return this.request(PATHS.subscription);
  }

  async createImage(body: Record<string, unknown>) {
    return this.request(PATHS.imageCreate, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async listImages(page = 1, limit = 12) {
    return this.request(`${PATHS.imageList}?page=${page}&limit=${limit}`);
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

  async createVideo(body: Record<string, unknown>) {
    return this.request(PATHS.videoCreate, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async listVideos(page = 1, limit = 12) {
    return this.request(`${PATHS.videoList}?page=${page}&limit=${limit}`);
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

  async createMusic(body: Record<string, unknown>) {
    return this.request(PATHS.musicCreate, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async listMusic(page = 1, limit = 12) {
    return this.request(`${PATHS.musicList}?page=${page}&limit=${limit}`);
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

  async createClip(body: Record<string, unknown>) {
    return this.request(PATHS.clipCreate, {
      method: "POST",
      body: JSON.stringify(body),
    });
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
}
