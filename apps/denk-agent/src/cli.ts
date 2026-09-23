import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { hostname } from "node:os";
import { connectLoop } from "./connect.ts";
import { pullKnowledge } from "./hub.ts";
import { processLocalEvrak } from "./process.ts";

const hub = process.env.DENK_HUB_URL ?? "http://127.0.0.1:8788";
const command = process.argv[2];

if (!command || command === "connect") {
  const machineId = (process.env.DENK_MACHINE_ID || hostname()).replace(/[^\p{L}\p{N}_.:-]/gu, "-").slice(0, 80);
  const localDir = process.env.DENK_LOCAL || "inbox";
  await connectLoop({ hubUrl: hub, machineId, hostname: hostname(), localDir });
} else {
  const file = command === "process" ? process.argv[3] : command;
  if (!file) {
    console.error("Kullanım: npm run connect   veya   npm run process -- <evrak.xml>");
    process.exit(1);
  }
  const pack = await pullKnowledge(hub);
  const xml = await readFile(file, "utf8");
  const result = processLocalEvrak(basename(file), "application/xml", xml, pack);
  console.log(`bilgi ${pack.version} · ${pack.vatDescription} · ${pack.cashAccount}`);
  console.log(result.preview);
  if (result.blockers.length) {
    console.error(result.blockers.join("\n"));
    process.exit(2);
  }
}
