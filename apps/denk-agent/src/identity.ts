import { assertLiveWindowsIdentity, type WindowsIdentity } from "../../../packages/consent-view/src/windows.ts";

export function liveWindowsIdentityFromEnv(env: NodeJS.ProcessEnv = process.env): WindowsIdentity | null {
  const account = env.DENK_WINDOWS_ACCOUNT?.trim() ?? "";
  const sid = env.DENK_WINDOWS_SID?.trim() ?? "";
  if (!account && !sid) return null;
  if (!account || !sid) {
    throw new Error("Windows hesabı ve SID birlikte olmalı (DENK_WINDOWS_ACCOUNT, DENK_WINDOWS_SID).");
  }
  return assertLiveWindowsIdentity({
    account,
    sid,
    interactive: true,
    attestedAt: new Date().toISOString(),
  });
}
