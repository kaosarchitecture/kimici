import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { attestWindowsIdentity } from "../../../packages/consent-view/src/windows.ts";
import type { WindowsIdentity } from "../../../packages/consent-view/src/types.ts";

const execFileAsync = promisify(execFile);

export class WindowsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WindowsAuthError";
  }
}

type RawIdentity = Pick<WindowsIdentity, "account" | "sid" | "interactive">;

export async function authorizeWindowsSession(
  read: () => Promise<RawIdentity>,
  ask: (account: string) => Promise<boolean>,
  now = new Date(),
): Promise<WindowsIdentity> {
  let raw: RawIdentity;
  try {
    raw = await read();
  } catch (error) {
    throw new WindowsAuthError(error instanceof Error ? error.message : "Windows kimliği okunamadı.");
  }
  if (!raw.interactive) {
    throw new WindowsAuthError("Onay yalnız etkileşimli Windows oturumundan verilir.");
  }
  const allowed = await ask(raw.account);
  if (!allowed) {
    throw new WindowsAuthError("Windows kullanıcısı bu bilgisayarda çalışmayı reddetti.");
  }
  try {
    return attestWindowsIdentity({
      account: raw.account,
      sid: raw.sid,
      interactive: true,
      attestedAt: now.toISOString(),
    });
  } catch (error) {
    throw new WindowsAuthError(error instanceof Error ? error.message : "Windows kimliği geçersiz.");
  }
}

function psSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function readWindowsIdentity(): Promise<RawIdentity> {
  if (process.platform !== "win32") {
    throw new WindowsAuthError("Bu ajan yalnız Windows oturumunda çalışır.");
  }
  const script = `
$wi = [System.Security.Principal.WindowsIdentity]::GetCurrent()
[pscustomobject]@{
  account = $wi.Name
  sid = $wi.User.Value
  interactive = [Environment]::UserInteractive
} | ConvertTo-Json -Compress
`;
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true, timeout: 15000 },
  );
  const parsed = JSON.parse(stdout) as { account?: string; sid?: string; interactive?: boolean };
  return {
    account: String(parsed.account ?? ""),
    sid: String(parsed.sid ?? ""),
    interactive: parsed.interactive === true,
  };
}

export async function askWindowsUser(account: string): Promise<boolean> {
  if (process.platform !== "win32") {
    throw new WindowsAuthError("Bu ajan yalnız Windows oturumunda çalışır.");
  }
  console.log(`Windows onayı açıldı: ${account}. Ekrandaki soruya evet deyin.`);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$answer = [System.Windows.Forms.MessageBox]::Show(
  ('DENK, ' + ${psSingleQuoted(account)} + ' oturumuyla bu bilgisayarda çalışsın mı?'),
  'DENK',
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Question,
  [System.Windows.Forms.MessageBoxDefaultButton]::Button1,
  [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly
)
if ($answer -eq [System.Windows.Forms.DialogResult]::Yes) { 'yes' } else { 'no' }
`;
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
    windowsHide: false,
    timeout: 120000,
  });
  return stdout.trim().toLowerCase() === "yes";
}
