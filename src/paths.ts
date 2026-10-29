/** Public API path suffixes (appended to baseUrl). */
export const PATHS = {
  credits: "/user/credits",
  subscription: "/user/subscription",
  catalog: "/catalog",
  catalogQuote: "/catalog/quote",
  catalogGenerate: "/catalog/generate",
  imageCreate: "/image-generations/create",
  imageList: "/image-generations/all",
  imageGet: (id: string) => `/image-generations/${id}`,
  imageDelete: (id: string) => `/image-generations/${id}`,
  imageStatus: (id: string) => `/image/status/${id}`,
  videoCreate: "/videos/create",
  videoList: "/videos/all",
  videoDelete: (id: string) => `/videos/${id}`,
  videoStatus: (id: string) => `/video/status/${id}`,
  musicCreate: "/music-generations/create",
  musicList: "/music-generations/all",
  musicGet: (id: string) => `/music-generations/${id}`,
  musicDelete: (id: string) => `/music-generations/${id}`,
  musicStatus: (id: string) => `/music/status/${id}`,
  clipCreate: "/clippings/create",
  clipList: "/clippings/all",
  clipGet: (id: string) => `/clippings/${id}`,
  clipStatus: (id: string) => `/clippings/status/${id}`,
  clipDelete: (id: string) => `/clippings/${id}`,
  clipItemDelete: (id: string, clipId: string) =>
    `/clippings/${id}/clips/${clipId}`,
  voiceoverVoices: "/voiceovers/voices",
  voiceoverCreate: "/voiceovers/create",
  voiceoverList: "/voiceovers/all",
  voiceoverDelete: (id: string) => `/voiceovers/${id}`,
  voiceoverStatus: (id: string) => `/voiceovers/status/${id}`,
  thumbnailCreate: "/thumbnails/create",
  thumbnailList: "/thumbnails",
  thumbnailGet: (id: string) => `/thumbnails/${id}`,
  thumbnailDelete: (id: string) => `/thumbnails/${id}`,
  influencerCreate: "/influencer-studio/create",
  influencerList: "/influencer-studio/all",
  influencerDelete: (id: string) => `/influencer-studio/${id}`,
  uploads: "/uploads",
  uploadSignedUrl: "/uploads/signed-url",
  uploadComplete: "/uploads/complete",
  uploadDelete: (id: string) => `/uploads/${id}`,
  accounts: "/accounts",
  pinterestBoards: (id: string) => `/accounts/${id}/pinterest/boards`,
  tiktokCreatorInfo: (id: string) => `/accounts/${id}/tiktok/creator-info`,
  posts: "/posts",
  postAnalyticsSummary: "/posts/analytics/summary",
  postAnalyticsRefresh: "/posts/analytics/refresh",
  postGet: (id: string) => `/posts/${id}`,
  postUpdate: (id: string) => `/posts/${id}`,
  postPublish: (id: string) => `/posts/${id}/publish`,
  postRetry: (id: string) => `/posts/${id}/retry`,
  postDelete: (id: string) => `/posts/${id}`,
} as const;

/**
 * Social platforms available for connected accounts / post scheduling.
 * Note: YouTube accounts are stored with provider "google".
 */
export const PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "linkedin",
  "bluesky",
  "threads",
  "pinterest",
  "x",
  "google_business",
] as const;

export const DEFAULT_BASE_URL = "https://mvp.tryunsora.com/api/v1";

/** Generation categories served by GET /catalog. */
export const CATALOG_CATEGORIES = ["video", "image", "motion-control"] as const;

/**
 * Music models (Mureka). Music is not part of GET /catalog, so this list is
 * kept here; video, image and motion-control models come from the live catalog.
 */
export const MUSIC_MODELS = [
  "auto",
  "mureka-9",
  "mureka-8",
  "mureka-o2",
  "mureka-7.6",
  "mureka-7.5",
] as const;

export const WEBSITE_URL = "https://tryunsora.com";
export const APP_URL = "https://app.tryunsora.com";
export const DOCS_URL = "https://tryunsora.com/docs";
export const MCP_URL = "https://mcp.tryunsora.com/mcp";
export const GITHUB_URL = "https://github.com/Shipped-Studio/unsora-cli";
