import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseTenantId } from "../../../packages/consent-view/src/tenant.ts";
import { pullKnowledge, syncPermittedView } from "./hub.ts";
import { liveWindowsIdentityFromEnv } from "./identity.ts";
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

const tenantRaw = process.env.DENK_TENANT?.trim() ?? "";
const identity = liveWindowsIdentityFromEnv();
if (!tenantRaw || !identity) {
  console.log("Yerel önizleme. İzinli görünüm itilmedi (DENK_TENANT + Windows hesabı/SID yok).");
  process.exit(0);
}

const outcome = await syncPermittedView({
  hubUrl: hub,
  tenant: parseTenantId(tenantRaw),
  identity,
  records: result.records,
});
if (outcome === "pushed") {
  console.log(`İzinli görünüm itildi · kiracı ${tenantRaw} · ${result.records.length} satır`);
} else {
  console.log("Bekleyen görünüm isteği yok. Yerel önizleme bu makinede kaldı.");
}
