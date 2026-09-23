import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pullKnowledge } from "./hub.ts";
import { processLocalEvrak } from "./process.ts";

const hub = process.env.DENK_HUB_URL ?? "https://denk-app.workers.dev";
const file = process.argv[2];
if (!file) {
  console.error("Kullanım: npm run process -- <evrak.xml>");
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
