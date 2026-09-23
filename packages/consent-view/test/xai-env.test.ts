import { describe, expect, it } from "vitest";
import { defaultXaiEnvPath, parseXaiEnv, sortGrokNewest, WINDOWS_XAI_ENV } from "../src/xai-env.ts";

describe("xai.env parser", () => {
  it("reads key names and grok ids without treating image models as chat", () => {
    const parsed = parseXaiEnv(`
# comment
export XAI_API_KEY=xai-test
XAI_API_KEY_1=xai-alt
XAI_MODELS=grok-4.5,grok-4.6,grok-imagine-image
grok-4.20-multi-agent-0309
MODEL=grok-4.5
`);
    expect(parsed.apiKey).toBe("xai-test");
    expect(parsed.apiKeys).toEqual(["xai-test", "xai-alt"]);
    expect(parsed.preferred).toBe("grok-4.5");
    expect(sortGrokNewest(parsed.models)[0]).toBe("grok-4.6");
    expect(parsed.models).toContain("grok-4.6");
    expect(parsed.models).not.toContain("grok-4.20-multi-agent-0309");
    expect(parsed.models).not.toContain("grok-imagine-image");
  });

  it("uses the Windows DENK path only on win32", () => {
    expect(defaultXaiEnvPath("win32", "")).toBe(WINDOWS_XAI_ENV);
    expect(defaultXaiEnvPath("linux", "")).toBe("");
    expect(defaultXaiEnvPath("linux", "/tmp/xai.env")).toBe("/tmp/xai.env");
  });
});
