/** Windows DENK machine only. Never commit this file. */
export const WINDOWS_XAI_ENV = "C:\\DENK\\secrets\\xai.env";

const SKIP = /imagine|image|video|tts|voice|whisper|embed|vision|audio/i;

export interface XaiEnvFile {
  apiKey: string;
  models: string[];
  preferred: string;
}

export function isChatGrok(id: string): boolean {
  const name = id.trim();
  if (!/^grok-\d/i.test(name)) return false;
  return !SKIP.test(name);
}

export function grokVersion(id: string): [number, number, number, number] {
  const match = /^grok-(\d+)(?:\.(\d+))?(?:\.(\d+))?/i.exec(id.trim());
  if (!match) return [0, 0, 0, 0];
  const extra = id.includes("-") && id.replace(/^grok-[\d.]+/i, "") ? 0 : 1;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0), extra];
}

export function sortGrokNewest(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(isChatGrok))].sort((a, b) => {
    const av = grokVersion(a);
    const bv = grokVersion(b);
    for (let i = 0; i < av.length; i += 1) {
      if (bv[i] !== av[i]) return (bv[i] ?? 0) - (av[i] ?? 0);
    }
    return a.length - b.length;
  });
}

function collectGrokTokens(raw: string): string[] {
  return raw.split(/[,;\s]+/).map((part) => part.trim()).filter(isChatGrok);
}

export function parseXaiEnv(text: string): XaiEnvFile {
  const models: string[] = [];
  let apiKey = "";
  let preferred = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) {
      models.push(...collectGrokTokens(line));
      continue;
    }

    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (/^(XAI_API_KEY|XAI_KEY|GROK_API_KEY)$/i.test(key)) {
      apiKey = value;
      continue;
    }
    if (/^(XAI_MODEL|GROK_MODEL|MODEL)$/i.test(key)) {
      preferred = value;
      models.push(...collectGrokTokens(value));
      continue;
    }
    if (/^(XAI_MODELS|GROK_MODELS|MODELS)$/i.test(key)) {
      models.push(...collectGrokTokens(value));
    }
  }

  return { apiKey, models: sortGrokNewest(models), preferred: preferred && isChatGrok(preferred) ? preferred : "" };
}

export function defaultXaiEnvPath(platform = process.platform, override = process.env.XAI_ENV_FILE): string {
  if (override) return override;
  return platform === "win32" ? WINDOWS_XAI_ENV : "";
}
