/** Public API path suffixes (appended to baseUrl). */
export const PATHS = {
  credits: "/user/credits",
  subscription: "/user/subscription",
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
  accounts: "/accounts",
  posts: "/posts",
  postGet: (id: string) => `/posts/${id}`,
  postUpdate: (id: string) => `/posts/${id}`,
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
] as const;

export const DEFAULT_BASE_URL = "https://mvp.tryunsora.com/api/v1";

/** Models exposed on the public API surface. */
export const IMAGE_MODELS = [
  "nano-banana-2",
  "nano-banana-pro",
  "seedream-v5-lite",
  "gpt-image-1.5",
  "gpt-image-2",
] as const;

export const MUSIC_MODELS = [
  "auto",
  "mureka-9",
  "mureka-8",
  "mureka-o2",
  "mureka-7.6",
  "mureka-7.5",
] as const;

/** All Wavespeed-backed models in the Unsora product (web app). */
export const ALL_WAVESPEED_MODELS = {
  video: [
    "kling-v3-standard",
    "kling-v3-pro",
    "veo-3.1",
    "veo-3.1-fast",
    "veo-3.1-lite",
    "sora-2",
    "sora-2-pro",
    "wan-2.6",
    "seedance-2.0",
    "seedance-2.0-fast",
    "seedance-2.0-mini",
    "gemini-omni-flash",
  ],
  image: [...IMAGE_MODELS],
  motionControl: [
    "kling-mc-2.6-pro",
    "kling-mc-3.0-pro",
    "kling-mc-3.0-std",
  ],
  music: [...MUSIC_MODELS],
} as const;

export const WEBSITE_URL = "https://tryunsora.com";
export const APP_URL = "https://app.tryunsora.com";
export const DOCS_URL = "https://tryunsora.com/docs";
export const MCP_URL = "https://mcp.tryunsora.com/mcp";
export const GITHUB_URL = "https://github.com/Shipped-Studio/unsora-cli";
