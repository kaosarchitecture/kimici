import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";

export function newApprovalCode(): string {
  return randomBytes(18).toString("base64url");
}

/** The code stays in the hash so the hub request log does not receive it. */
export function approvalPageUrl(hubUrl: string, machineId: string, code: string): string {
  const url = new URL(hubUrl);
  url.search = "";
  url.hash = `onay=${encodeURIComponent(code)}&makine=${encodeURIComponent(machineId)}`;
  return url.toString();
}

export function openApprovalPage(url: string): void {
  if (process.platform !== "win32") {
    console.log(url);
    return;
  }
  execFile("rundll32.exe", ["url.dll,FileProtocolHandler", url], { windowsHide: true }, (error) => {
    if (error) console.log(url);
  });
}
