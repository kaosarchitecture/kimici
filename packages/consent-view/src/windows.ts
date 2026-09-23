import type { WindowsIdentity } from "./types.ts";

const ACCOUNT = /^[^\\/]+\\[^\\/]+$/;
const SID = /^S-1-5-(?:21-)?[A-Za-z0-9-]+$/;

const FORBIDDEN_KEYS = /password|parola|secret|token|cookie|authorization|passwd/i;

export function assertNoSecretFields(value: unknown, path = "identity"): void {
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) {
      throw new Error(`${path}.${key} sunucuya gönderilemez.`);
    }
    assertNoSecretFields(child, `${path}.${key}`);
  }
}

/** Validates a local Windows attestation. The password never leaves the user machine. */
export function attestWindowsIdentity(input: WindowsIdentity): WindowsIdentity {
  assertNoSecretFields(input);
  const account = input.account.trim();
  const sid = input.sid.trim();
  if (!ACCOUNT.test(account)) {
    throw new Error("Windows hesabı DOMAIN\\kullanıcı biçiminde olmalı.");
  }
  if (!SID.test(sid)) {
    throw new Error("Windows SID geçersiz.");
  }
  if (!input.interactive) {
    throw new Error("Onay yalnız etkileşimli Windows oturumundan verilir.");
  }
  if (!input.attestedAt) {
    throw new Error("Windows kimlik zamanı yok.");
  }
  return { account, sid, interactive: true, attestedAt: input.attestedAt };
}

/** Demo-only stand-in. Live agent reads the interactive WindowsIdentity on that PC. */
export function demoWindowsIdentity(now = new Date()): WindowsIdentity {
  return {
    account: "DEMO\\Kullanici",
    sid: "S-1-5-21-DEMO-1001",
    interactive: true,
    attestedAt: now.toISOString(),
  };
}
