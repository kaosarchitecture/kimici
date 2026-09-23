import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseTenantId } from "../../../packages/consent-view/src/tenant.ts";
import { enrollDevice, pullKnowledge, syncPermittedView } from "./hub.ts";
import { liveWindowsIdentityFromEnv } from "./identity.ts";
import { processLocalEvrak } from "./process.ts";

const hub = process.env.DENK_HUB_URL ?? "https://denk-app.workers.dev";
const command = process.argv[2];

if (command === "enroll" || process.env.DENK_ENROLL_CODE) {
  const code = command === "enroll" ? process.argv[3] : process.env.DENK_ENROLL_CODE;
  if (!code) {
    console.error("Kullanım: npm run enroll -- <kayıt-kodu>");
    process.exit(1);
  }
  const enrolled = await enrollDevice(hub, code);
  console.log(`kiracı ${enrolled.tenant}`);
  console.log(`cihaz anahtarı (bir kez): ${enrolled.deviceKey}`);
  console.log("DENK_TENANT ve DENK_DEVICE_KEY olarak sakla. Tekrar gösterilmez.");
  process.exit(0);
}

const file = command;
if (!file) {
  console.error("Kullanım: npm run process -- <evrak.xml>");
  console.error("Kayıt: npm run enroll -- <kayıt-kodu>");
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
const deviceKey = process.env.DENK_DEVICE_KEY?.trim() ?? "";
const identity = liveWindowsIdentityFromEnv();
if (!tenantRaw || !deviceKey || !identity) {
  console.log("Yerel önizleme. İzinli görünüm itilmedi (DENK_TENANT + DENK_DEVICE_KEY + Windows hesabı/SID yok).");
  process.exit(0);
}

const outcome = await syncPermittedView({
  hubUrl: hub,
  tenant: parseTenantId(tenantRaw),
  deviceKey,
  identity,
  records: result.records,
});
if (outcome === "pushed") {
  console.log(`İzinli görünüm itildi · kiracı ${tenantRaw} · ${result.records.length} satır`);
} else {
  console.log("Bekleyen görünüm isteği yok. Yerel önizleme bu makinede kaldı.");
}
