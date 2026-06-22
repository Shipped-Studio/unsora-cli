import Conf from "conf";

export interface UnsoraConfig {
  apiKey?: string;
  baseUrl?: string;
}

const store = new Conf<UnsoraConfig>({
  projectName: "unsora-cli",
  schema: {
    apiKey: { type: "string" },
    baseUrl: { type: "string" },
  },
});

export function getConfig(): UnsoraConfig {
  return {
    apiKey: process.env.UNSORA_API_KEY ?? store.get("apiKey"),
    baseUrl: process.env.UNSORA_API_URL ?? store.get("baseUrl"),
  };
}

export function setConfigKey(key: keyof UnsoraConfig, value: string): void {
  store.set(key, value);
}

export function clearConfig(): void {
  store.clear();
}

export function getConfigPath(): string {
  return store.path;
}
