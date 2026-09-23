import { hostname } from "node:os";
import { connectLoop } from "./connect.ts";
import { authorizeWindowsSession, readWindowsIdentity, WindowsAuthError } from "./windows-auth.ts";

const hub = process.env.DENK_HUB_URL ?? "http://127.0.0.1:8788";
const machineId = (process.env.DENK_MACHINE_ID || hostname()).replace(/[^\p{L}\p{N}_.:-]/gu, "-").slice(0, 80);

try {
  await connectLoop({
    hubUrl: hub,
    machineId,
    hostname: hostname(),
    authorize: () => authorizeWindowsSession(readWindowsIdentity, async () => true),
  });
} catch (error) {
  if (error instanceof WindowsAuthError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
