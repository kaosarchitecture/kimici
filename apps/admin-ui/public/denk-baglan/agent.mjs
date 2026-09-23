// src/cli.ts
import { readFile as readFile3 } from "node:fs/promises";
import { basename as basename2 } from "node:path";
import { hostname } from "node:os";

// src/connect.ts
import { mkdir } from "node:fs/promises";

// src/hub.ts
async function pullKnowledge(hubUrl) {
  const res = await fetch(new URL("/api/knowledge", hubUrl));
  if (!res.ok) throw new Error(`Bilgi paketi al\u0131namad\u0131: HTTP ${res.status}`);
  const body = await res.json();
  if (!body.pack?.vatDescription) throw new Error("Bilgi paketi bozuk.");
  return body.pack;
}

// src/local-model.ts
import { readFile } from "node:fs/promises";

// ../../packages/consent-view/src/xai-env.ts
var WINDOWS_XAI_ENV = "C:\\DENK\\secrets\\xai.env";
var SKIP = /imagine|image|video|tts|voice|whisper|embed|vision|audio|multi-agent/i;
function isChatGrok(id) {
  const name = id.trim();
  if (!/^grok-\d/i.test(name)) return false;
  return !SKIP.test(name);
}
function grokVersion(id) {
  const match = /^grok-(\d+)(?:\.(\d+))?(?:\.(\d+))?/i.exec(id.trim());
  if (!match) return [0, 0, 0, 0];
  const extra = id.includes("-") && id.replace(/^grok-[\d.]+/i, "") ? 0 : 1;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0), extra];
}
function sortGrokNewest(ids) {
  return [...new Set(ids.map((id) => id.trim()).filter(isChatGrok))].sort((a, b) => {
    const av = grokVersion(a);
    const bv = grokVersion(b);
    for (let i = 0; i < av.length; i += 1) {
      if (bv[i] !== av[i]) return (bv[i] ?? 0) - (av[i] ?? 0);
    }
    return a.length - b.length;
  });
}
function collectGrokTokens(raw) {
  return raw.split(/[,;\s]+/).map((part) => part.trim()).filter(isChatGrok);
}
function parseXaiEnv(text) {
  const models = [];
  const apiKeys = [];
  let apiKey = "";
  let preferred = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) {
      models.push(...collectGrokTokens(line));
      continue;
    }
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (/^(XAI_API_KEY_\d+|XAI_API_KEY|XAI_KEY|GROK_API_KEY)$/i.test(key)) {
      if (value) apiKeys.push(value);
      if (/^(XAI_API_KEY|XAI_KEY|GROK_API_KEY)$/i.test(key) && value) apiKey = value;
      continue;
    }
    if (/^(XAI_MODEL|GROK_MODEL|MODEL)$/i.test(key)) {
      preferred = value;
      models.push(...collectGrokTokens(value));
      continue;
    }
    if (/^(XAI_MODELS|GROK_MODELS|MODELS)$/i.test(key)) {
      models.push(...collectGrokTokens(value));
    }
  }
  const uniqueKeys = [...new Set(apiKeys.filter(Boolean))];
  return {
    apiKey: apiKey || uniqueKeys[0] || "",
    apiKeys: uniqueKeys,
    models: sortGrokNewest(models),
    preferred: preferred && isChatGrok(preferred) ? preferred : ""
  };
}
function defaultXaiEnvPath(platform = process.platform, override = process.env.XAI_ENV_FILE) {
  if (override) return override;
  return platform === "win32" ? WINDOWS_XAI_ENV : "";
}

// ../../packages/consent-view/src/ai.ts
var DEFAULT_XAI_MODEL = "grok-4.20-0309-reasoning";
var XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
var SYSTEM_PROMPT = [
  "Sen DENK AI\u2019s\u0131n. \u0130\u015Fin evrak ve muhasebe fi\u015Fi: oku, de\u011Ferlendir, sat\u0131rlar\u0131 kur, i\u015Fle.",
  "Y\xFCklenen evrak\u0131n \xE7\u0131kar\u0131lan alanlar\u0131n\u0131 ve kurulan fi\u015F sat\u0131rlar\u0131n\u0131 g\xF6r\xFCrs\xFCn.",
  "Tutar\u0131 evraktan al; yoksa yok de, uydurma.",
  "Kanonik yaz\u0131m: KDV a\xE7\u0131klamas\u0131 \u0130ND.KDV. (noktas\u0131z, bo\u015Fluksuz). Nakit kapan\u0131\u015F 100 01.",
  "Al\u0131\u015F faturas\u0131: 770 bor\xE7 (gider), 191 02 20 \u0130ND.KDV. bor\xE7, 320 alacak (N.FT \u0130LE ALI\u015E).",
  "Cevab\u0131nda fi\u015Fi de\u011Ferlendir: hesap, B/A, tutar, a\xE7\u0131klama, eksik veya tutars\u0131z sat\u0131r.",
  "T\xFCrk\xE7e, somut, fi\u015F dili. \u0130\u015Fini yap."
].join(" ");
function xaiChatBody(messages, model = DEFAULT_XAI_MODEL) {
  return { model, messages };
}
function textFromContent(content) {
  if (typeof content === "string" && content.trim()) return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object" && "text" in part) return String(part.text ?? "");
    return "";
  }).join("").trim();
}
function extractModelText(result) {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (!result || typeof result !== "object") return "";
  const row = result;
  if (Array.isArray(row.choices) && row.choices[0] && typeof row.choices[0] === "object") {
    const choice = row.choices[0];
    const message = choice.message;
    if (message && typeof message === "object") {
      const fromMsg = textFromContent(message.content);
      if (fromMsg) return fromMsg;
    }
    const fromText = textFromContent(choice.text);
    if (fromText) return fromText;
  }
  for (const key of ["response", "result", "output_text", "text"]) {
    if (typeof row[key] === "string" && String(row[key]).trim()) return String(row[key]).trim();
  }
  if (row.result && typeof row.result === "object") return extractModelText(row.result);
  return "";
}
async function runXaiChat(apiKey, messages, model = DEFAULT_XAI_MODEL) {
  const res = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(xaiChatBody(messages, model))
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error?.message ?? `xAI HTTP ${res.status}`);
  }
  const reply = extractModelText(payload);
  if (!reply) throw new Error(`${model} bo\u015F cevap verdi.`);
  return reply;
}

// src/local-model.ts
async function localModelNote(pack, preview) {
  const creds = await localCreds(pack.modelHint);
  if (!creds) return null;
  const messages = [
    { role: "system", content: pack.prompt },
    {
      role: "user",
      content: `Bu fi\u015F bu bilgisayarda, buluttaki kural paketi ${pack.version} ile kuruldu. Tutarlar\u0131 de\u011Fi\u015Ftirme. De\u011Ferlendir:
${preview}`
    }
  ];
  try {
    return await runXaiChat(creds.key, messages, creds.model);
  } catch {
    return null;
  }
}
async function localCreds(fallbackModel) {
  const envKey = process.env.XAI_API_KEY?.trim();
  if (envKey) return { key: envKey, model: process.env.XAI_MODEL?.trim() || fallbackModel };
  const path = defaultXaiEnvPath();
  if (!path) return null;
  try {
    const parsed = parseXaiEnv(await readFile(path, "utf8"));
    if (!parsed.apiKey) return null;
    return { key: parsed.apiKey, model: parsed.preferred || process.env.XAI_MODEL?.trim() || fallbackModel };
  } catch {
    return null;
  }
}

// src/inbox.ts
import { readdir, readFile as readFile2 } from "node:fs/promises";
import { basename, join } from "node:path";

// ../../packages/eta-core/src/money.ts
var TR_AMOUNT = /^-?\d+(?:\.\d{1,2})?$/;
function parseTrAmount(text) {
  const compact = text.trim().replace(/\s+/g, "");
  if (compact.length === 0) {
    throw new Error(`Tutar bo\u015F: "${text}"`);
  }
  const commaCount = compact.split(",").length - 1;
  if (commaCount > 1) {
    throw new Error(`Tutar bi\xE7imi tan\u0131nmad\u0131: "${text}"`);
  }
  if (commaCount === 0 && compact.includes(".")) {
    throw new Error(`Tutar bi\xE7imi tan\u0131nmad\u0131: "${text}"`);
  }
  const normalized = compact.replace(/\./g, "").replace(",", ".");
  if (!TR_AMOUNT.test(normalized)) {
    throw new Error(`Tutar bi\xE7imi tan\u0131nmad\u0131: "${text}"`);
  }
  return decimalStringToKurus(normalized);
}
function tlToKurus(value) {
  if (!Number.isFinite(value)) {
    throw new Error(`Ge\xE7ersiz tutar: ${value}`);
  }
  return Math.round(value * 100 + (value >= 0 ? 1e-9 : -1e-9));
}
function decimalStringToKurus(value) {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [intPart = "0", fracPart = ""] = unsigned.split(".");
  const kurus = Number(intPart) * 100 + Number(fracPart.padEnd(2, "0").slice(0, 2));
  return negative ? -kurus : kurus;
}
function formatTr(kurus) {
  const sign = kurus < 0 ? "-" : "";
  const abs = Math.abs(kurus);
  const lira = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${lira},${String(abs % 100).padStart(2, "0")}`;
}
function percentOf(kurus, percent) {
  if (kurus < 0) {
    throw new Error("percentOf yaln\u0131zca pozitif tutarlarla \xE7al\u0131\u015F\u0131r");
  }
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error(`Ge\xE7ersiz y\xFCzde: ${percent}`);
  }
  return Math.floor((kurus * percent * 2 + 100) / 200);
}

// ../../packages/consent-view/src/ubl.ts
function tag(xml, local) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b[^>]*>([^<]*)</(?:[\\w.-]+:)?${local}>`, "i");
  return (re.exec(xml)?.[1] ?? "").trim();
}
function formatTrFromPlain(raw) {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return raw || "0,00";
  const kurus = Math.round(num * 100);
  const sign = kurus < 0 ? "-" : "";
  const abs = Math.abs(kurus);
  const whole = String(Math.floor(abs / 100));
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped},${frac}`;
}
function parseUblInvoice(xml, fileName, mime, size) {
  const invoiceNo = tag(xml, "ID");
  const issueDate = tag(xml, "IssueDate");
  const supplierName = tag(xml, "Name") || tag(xml, "RegistrationName");
  const net = tag(xml, "TaxExclusiveAmount");
  const vat = tag(xml, "TaxAmount");
  const payable = tag(xml, "PayableAmount");
  const looksUbl = /Invoice/i.test(xml) && Boolean(invoiceNo || payable);
  return {
    fileName,
    mime,
    size,
    receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
    kind: looksUbl ? "ubl-invoice" : "file",
    invoiceNo,
    issueDate,
    supplierName,
    netText: formatTrFromPlain(net),
    vatText: formatTrFromPlain(vat),
    payableText: formatTrFromPlain(payable)
  };
}
function documentFromFile(fileName, mime, size, xml) {
  if (xml && /<\w/.test(xml)) return parseUblInvoice(xml, fileName, mime, size);
  return {
    fileName,
    mime,
    size,
    receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
    kind: "file",
    invoiceNo: "",
    issueDate: "",
    supplierName: "",
    netText: "",
    vatText: "",
    payableText: ""
  };
}

// ../../packages/eta-core/src/types.ts
function totals(lines) {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    if (line.side === "D") debit += line.amount;
    else credit += line.amount;
  }
  return { debit, credit };
}

// ../../packages/eta-core/src/preview.ts
function formatPlanPreview(plan) {
  const { debit, credit } = totals(plan.lines);
  const lines = [
    `\u015Eirket DB: ${plan.companyDb}`,
    `Fi\u015F tipi: ${plan.kind} (${plan.mode})`,
    `Fi\u015F tarihi: ${plan.headerDate}`,
    ...plan.specialCode1 ? [`\xD6zel kod: ${plan.specialCode1}`] : [],
    ...plan.headerNote ? [`Ba\u015Fl\u0131k notu: ${plan.headerNote}`] : [],
    `Sat\u0131r: ${plan.lines.length}`,
    `Bor\xE7: ${formatTr(debit)}  Alacak: ${formatTr(credit)}  Fark: ${formatTr(debit - credit)}`,
    "",
    "S\u0131ra  Hesap            B/A      Tutar  Sat\u0131r tarihi           Kural                 A\xE7\u0131klama"
  ];
  for (const line of plan.lines) {
    const side = line.side === "D" ? "B" : "A";
    lines.push(
      `${String(line.seq).padStart(4)}  ${line.account.padEnd(15)} ${side}  ${formatTr(line.amount).padStart(12)}  ${line.lineDate.padEnd(19)}  ${line.ruleId.padEnd(22)} ${line.description}`
    );
  }
  if (plan.blockers.length > 0) {
    lines.push("", "Durdurucu:");
    for (const blocker of plan.blockers) lines.push(`- [${blocker.code}] ${blocker.message}`);
  }
  return lines.join("\n");
}

// ../../packages/eta-core/src/accounts.ts
function accountLevels(code) {
  return code.trim().split(/\s+/).filter((part) => part.length > 0);
}
function rootAccount(code) {
  return accountLevels(code)[0] ?? "";
}

// ../../packages/eta-core/src/rules/purchase-invoice.ts
var NFT_THRESHOLD = 3e6;
var TEXT = {
  nftPurchase: "N.FT \u0130LE ALI\u015E",
  vatDefault: "\u0130ND.KDV.",
  kkegMemo: "K.K.E.G\u0130DERLER",
  vatSpecialCode: "INDKDV",
  purchaseSpecialCode1: "ALF",
  purchaseHeaderNote: "ALIM FATURASI",
  /** Unmapped / cash closing. Canonical spelling is `100 01` (space, two-digit subcode). */
  cashAccount: "100 01"
};
var DEFAULT_PASSENGER_CAR = {
  expenseAccount: "770 13",
  kkegAccount: "689 01",
  memoDebitAccount: "950 01",
  memoCreditAccount: "951 01",
  acceptedPercent: 70
};
function planPurchaseInvoice(input) {
  const blockers = [];
  const supplierName = input.supplierName.trim();
  if (supplierName.length === 0) {
    blockers.push({
      code: "SUPPLIER_NAME_MISSING",
      message: "Tedarik\xE7i unvan\u0131 veya ad\u0131 yok. A\xE7\u0131klamaya 'ALIM' yaz\u0131lamaz, i\u015Flem durduruldu."
    });
  }
  const closing = resolveClosing(input, supplierName, blockers);
  const base = {
    docNo: input.invoiceNo.trim(),
    lineDate: input.issueDate,
    docDate: input.issueDate
  };
  const expenseDetail = {
    ...closing.account && closing.isSupplier ? { reference: `(${closing.account})` } : {},
    ...input.item ? { item: input.item } : {},
    ...input.unit ? { unit: input.unit } : {},
    quantity: input.quantity ?? 1
  };
  const vatDescription = input.vatDescription ?? TEXT.vatDefault;
  const lines = [];
  if (input.category === "passenger-car-service") {
    const car = input.passengerCar ?? DEFAULT_PASSENGER_CAR;
    const acceptedExpense = percentOf(input.netAmount, car.acceptedPercent);
    const acceptedVat = percentOf(input.vatAmount, car.acceptedPercent);
    const kkeg = input.payableAmount - acceptedExpense - acceptedVat;
    const kkegByRatio = percentOf(input.payableAmount, 100 - car.acceptedPercent);
    if (Math.abs(kkeg - kkegByRatio) > 1) {
      blockers.push({
        code: "KKEG_MISMATCH",
        message: `KKEG kalan\u0131 (${kkeg}) oran hesab\u0131ndan (${kkegByRatio}) 1 kuru\u015Ftan fazla sap\u0131yor. Faturada ba\u015Fka vergi veya tevkifat olabilir.`
      });
    }
    lines.push(
      { ...base, account: car.expenseAccount, side: "D", amount: acceptedExpense, description: supplierName, specialCode: TEXT.vatSpecialCode, detail: expenseDetail, ruleId: "R16.passenger-car.accepted-expense" },
      { ...base, account: car.kkegAccount, side: "D", amount: kkeg, description: supplierName, specialCode: TEXT.vatSpecialCode, ruleId: "R16.passenger-car.kkeg" },
      { ...base, account: input.vatAccount, side: "D", amount: acceptedVat, description: vatDescription, specialCode: TEXT.vatSpecialCode, ruleId: "R16.passenger-car.accepted-vat" },
      { ...base, account: closing.account, side: "C", amount: input.payableAmount, description: closing.description, ruleId: closing.ruleId },
      { ...base, account: car.memoDebitAccount, side: "D", amount: kkeg, description: TEXT.kkegMemo, ruleId: "R16.passenger-car.memo" },
      { ...base, account: car.memoCreditAccount, side: "C", amount: kkeg, description: TEXT.kkegMemo, ruleId: "R16.passenger-car.memo" }
    );
  } else {
    if (!input.expenseAccount) {
      blockers.push({
        code: "EXPENSE_ACCOUNT_MISSING",
        message: "Gider/mal hesab\u0131 belirlenmedi. \u015Eirketin \xF6nceki faturalar\u0131ndan \xF6neri al\u0131nmal\u0131."
      });
    }
    if (input.netAmount + input.vatAmount !== input.payableAmount) {
      blockers.push({
        code: "PAYABLE_MISMATCH",
        message: "Matrah + KDV \xF6denecek tutara e\u015Fit de\u011Fil. Tevkifat veya ek vergi kal\u0131b\u0131 hen\xFCz desteklenmiyor."
      });
    }
    const ruleId = input.category === "trade-goods" ? "R19.trade-goods" : "R19.general-expense";
    lines.push(
      { ...base, account: input.expenseAccount ?? "", side: "D", amount: input.netAmount, description: supplierName, specialCode: TEXT.vatSpecialCode, detail: expenseDetail, ruleId },
      { ...base, account: input.vatAccount, side: "D", amount: input.vatAmount, description: vatDescription, specialCode: TEXT.vatSpecialCode, ruleId: `${ruleId}.vat` },
      { ...base, account: closing.account, side: "C", amount: input.payableAmount, description: closing.description, ruleId: closing.ruleId }
    );
  }
  return {
    companyDb: input.companyDb,
    kind: "FAT",
    mode: "single-invoice",
    headerDate: input.issueDate,
    specialCode1: TEXT.purchaseSpecialCode1,
    headerNote: TEXT.purchaseHeaderNote,
    lines: lines.map((line, index) => ({ ...line, seq: index + 1 })),
    blockers
  };
}
function resolveClosing(input, supplierName, blockers) {
  const cash = input.cashAccount ?? TEXT.cashAccount;
  if (input.supplierAccount && rootAccount(input.supplierAccount) !== "320") {
    blockers.push({
      code: "SUPPLIER_ACCOUNT_NOT_320",
      message: `Tedarik\xE7i hesab\u0131 320 grubunda de\u011Fil: ${input.supplierAccount}`
    });
  }
  if (input.payableAmount >= NFT_THRESHOLD) {
    if (!input.supplierAccount) {
      blockers.push({
        code: "NEW_SUPPLIER_ACCOUNT_REQUIRED",
        message: "30.000 TL ve \xFCzeri fatura i\xE7in cari kart yok. Kasaya kapat\u0131lamaz; \xF6nce 320 cari kart\u0131 a\xE7\u0131lmal\u0131 (onay gerekir)."
      });
      return { account: "", description: TEXT.nftPurchase, isSupplier: true, ruleId: "R13.nft.new-supplier" };
    }
    return { account: input.supplierAccount, description: TEXT.nftPurchase, isSupplier: true, ruleId: "R13.nft.supplier" };
  }
  if (input.supplierAccount) {
    return { account: input.supplierAccount, description: supplierName, isSupplier: true, ruleId: "R13.below.supplier" };
  }
  return { account: cash, description: supplierName, isSupplier: false, ruleId: "R13.below.cash" };
}

// src/process.ts
function planLocalFields(fields, pack) {
  const invoiceNo = fields.invoiceNo.trim();
  const issueDate = fields.issueDate.trim();
  if (!invoiceNo || !issueDate) throw new Error("Evrak no veya tarih yok.");
  const net = parseTrAmount(fields.netText);
  const vat = parseTrAmount(fields.vatText);
  const payable = parseTrAmount(fields.payableText);
  const plan = planPurchaseInvoice({
    companyDb: "LOCAL",
    invoiceNo,
    issueDate,
    supplierName: fields.supplierName.trim(),
    netAmount: net,
    vatAmount: vat,
    payableAmount: payable,
    category: "general-expense",
    vatAccount: pack.vatAccount,
    supplierAccount: payable >= pack.nftThresholdKurus ? "320" : null,
    expenseAccount: pack.expenseAccount,
    cashAccount: pack.cashAccount,
    vatDescription: pack.vatDescription
  });
  const { debit, credit } = totals(plan.lines);
  return {
    sourceName: fields.sourceName,
    sourceKind: fields.sourceKind,
    invoiceNo,
    date: issueDate,
    supplierName: fields.supplierName.trim(),
    debit: formatTr(debit),
    credit: formatTr(credit),
    preview: formatPlanPreview(plan),
    blockers: plan.blockers.map((item) => item.message),
    lines: plan.lines.map((line) => ({
      seq: line.seq,
      account: line.account,
      side: line.side === "D" ? "B" : "A",
      amountText: formatTr(line.amount),
      description: line.description,
      date: line.lineDate
    }))
  };
}
function processLocalEvrak(fileName, mime, xml, pack) {
  const document = documentFromFile(fileName, mime, xml.length, xml);
  const voucher = planLocalFields(
    {
      sourceName: fileName,
      sourceKind: "xml",
      invoiceNo: document.invoiceNo || fileName,
      issueDate: document.issueDate,
      supplierName: document.supplierName || fileName,
      netText: document.netText,
      vatText: document.vatText,
      payableText: document.payableText
    },
    pack
  );
  return { document, preview: voucher.preview, blockers: voucher.blockers, voucher };
}

// src/inbox.ts
var MAX_FILES = 20;
var MAX_BYTES = 2 * 1024 * 1024;
async function runInbox(localDir, pack) {
  let names = [];
  try {
    names = await readdir(localDir);
  } catch {
    return { status: "empty", note: "Bu bilgisayarda i\u015F klas\xF6r\xFC yok.", vouchers: [] };
  }
  const files = names.filter((name) => !name.startsWith(".")).sort((a, b) => a.localeCompare(b, "tr")).slice(0, MAX_FILES);
  const vouchers = [];
  const problems = [];
  for (const name of files) {
    const kind = classify(name);
    if (!kind) continue;
    try {
      const full = join(localDir, name);
      const raw = await readFile2(full);
      if (raw.byteLength > MAX_BYTES) {
        problems.push(`${name}: 2 MB \xFCst\xFC atland\u0131.`);
        continue;
      }
      const text = raw.toString("utf8").replace(/^\uFEFF/, "");
      for (const fields of recordsFrom(name, kind, text)) {
        vouchers.push(planLocalFields(fields, pack));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "okunamad\u0131";
      problems.push(`${name}: ${message}`);
    }
  }
  const extra = names.length > MAX_FILES ? ` \u0130lk ${MAX_FILES} dosyaya bak\u0131ld\u0131.` : "";
  if (vouchers.length === 0 && problems.length === 0) {
    return {
      status: "empty",
      note: `Bu bilgisayarda log, audit veya XML yok.${extra} Klas\xF6r: ${basename(localDir) || localDir}`,
      vouchers: []
    };
  }
  const blocked = vouchers.some((row) => row.blockers.length > 0);
  const status = vouchers.length === 0 ? "failed" : blocked ? "blocked" : "done";
  const kinds = [...new Set(vouchers.map((row) => row.sourceKind))].join(", ");
  const head = vouchers.length ? `${vouchers.length} kay\u0131t bu bilgisayarda i\u015Flendi (${kinds || "yok"}). Kural ${pack.version}.` : "Bu bilgisayarda fi\u015F kurulamad\u0131.";
  const note = `${[head, ...problems].join(" ")}${extra}`.slice(0, 500);
  return { status, note, vouchers };
}
function classify(name) {
  const lower = name.toLocaleLowerCase("tr-TR");
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".json") && lower.includes("audit")) return "audit";
  if (lower.endsWith(".log") || lower.endsWith(".log.txt") || lower.includes("log") && lower.endsWith(".txt")) return "log";
  return null;
}
function recordsFrom(name, kind, text) {
  if (kind === "xml") return [fieldsFromXml(name, text)];
  if (kind === "audit") return auditRecords(name, text);
  return logRecords(name, text);
}
function fieldsFromXml(name, text) {
  const document = documentFromFile(name, "application/xml", text.length, text);
  return {
    sourceName: name,
    sourceKind: "xml",
    invoiceNo: document.invoiceNo,
    issueDate: normalizeDate(document.issueDate),
    supplierName: document.supplierName,
    netText: document.netText,
    vatText: document.vatText,
    payableText: document.payableText
  };
}
function auditRecords(name, text) {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error("audit kayd\u0131 nesne de\u011Fil");
    const record = row;
    const suffix = rows.length > 1 ? `#${index + 1}` : "";
    return {
      sourceName: `${name}${suffix}`,
      sourceKind: "audit",
      invoiceNo: pick(record, ["invoiceNo", "evrak", "fatura", "id"]),
      issueDate: normalizeDate(pick(record, ["issueDate", "tarih", "date"])),
      supplierName: pick(record, ["supplierName", "unvan", "tedarikci", "tedarik\xE7i", "name"]),
      netText: asAmount(pickRaw(record, ["net", "netText", "matrah"])),
      vatText: asAmount(pickRaw(record, ["vat", "vatText", "kdv"])),
      payableText: asAmount(pickRaw(record, ["payable", "payableText", "odenecek", "\xF6denecek"]))
    };
  });
}
function logRecords(name, text) {
  const blocks = text.split(/\n(?=(?:EVRAK|FATURA)\b)/i).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block, index) => {
    const bag = {};
    for (const line of block.split(/\r?\n/)) {
      const match = /^([\p{L}\p{N}.]+)(?:\s*[:=]\s*|\s+)(\S.*)$/u.exec(line.trim());
      if (!match) continue;
      const key = foldKey(match[1] ?? "");
      const value = (match[2] ?? "").trim();
      const field = LOG_KEYS[key];
      if (field) bag[field] = value;
    }
    const suffix = blocks.length > 1 ? `#${index + 1}` : "";
    return {
      sourceName: `${name}${suffix}`,
      sourceKind: "log",
      invoiceNo: bag.invoiceNo ?? "",
      issueDate: normalizeDate(bag.issueDate ?? ""),
      supplierName: bag.supplierName ?? "",
      netText: bag.net ?? "",
      vatText: bag.vat ?? "",
      payableText: bag.payable ?? ""
    };
  });
}
var LOG_KEYS = {
  evrak: "invoiceNo",
  fatura: "invoiceNo",
  invoiceno: "invoiceNo",
  tarih: "issueDate",
  issuedate: "issueDate",
  unvan: "supplierName",
  tedarikci: "supplierName",
  tedarik\u00E7i: "supplierName",
  suppliername: "supplierName",
  matrah: "net",
  kdv: "vat",
  odenecek: "payable",
  \u00F6denecek: "payable"
};
function pick(record, names) {
  const raw = pickRaw(record, names);
  return raw == null ? "" : String(raw).trim();
}
function foldKey(raw) {
  return raw.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/\./g, "");
}
function pickRaw(record, names) {
  const wanted = new Set(names.map((name) => foldKey(name)));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(foldKey(key))) return value;
  }
  return void 0;
}
function asAmount(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number") return formatTr(tlToKurus(value));
  const text = String(value).trim();
  if (/^-?\d+\.\d{1,2}$/.test(text)) return formatTr(decimalStringToKurus(text));
  return text;
}
function normalizeDate(raw) {
  const text = raw.trim();
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(text);
  if (tr) return `${tr[3]}-${tr[2]}-${tr[1]}`;
  return text.slice(0, 10);
}

// src/session.ts
async function handleHubMessage(runtime, message, io = {}) {
  if (message.type === "rules" && message.pack?.version) {
    return { runtime: { ...runtime, pack: message.pack }, outbound: null };
  }
  if (message.type !== "job.run" || !message.jobId) {
    return { runtime, outbound: null };
  }
  if (!runtime.pack) {
    return {
      runtime,
      outbound: {
        type: "agent.result",
        jobId: message.jobId,
        machineId: runtime.machineId,
        status: "failed",
        note: "Kural paketi bu ba\u011Flant\u0131da yok.",
        vouchers: []
      }
    };
  }
  const work = io.runInbox ?? runInbox;
  let result;
  try {
    result = await work(runtime.localDir, runtime.pack);
  } catch (error) {
    const note = error instanceof Error ? error.message : "Bu bilgisayarda i\u015Flem durdu.";
    return {
      runtime,
      outbound: {
        type: "agent.result",
        jobId: message.jobId,
        machineId: runtime.machineId,
        status: "failed",
        note,
        vouchers: []
      }
    };
  }
  const outbound = {
    type: "agent.result",
    jobId: message.jobId,
    machineId: runtime.machineId,
    status: result.status,
    note: result.note,
    vouchers: result.vouchers
  };
  if (io.narrate && result.vouchers.length > 0) {
    const preview = result.vouchers.map((row) => row.preview).join("\n\n").slice(0, 6e3);
    const modelNote = await io.narrate(runtime.pack, preview);
    if (modelNote?.trim()) outbound.modelNote = modelNote.trim();
  }
  return { runtime, outbound };
}

// src/connect.ts
function agentSocketUrl(hubUrl) {
  const url = new URL("/api/agent", hubUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
async function connectOnce(options) {
  await mkdir(options.localDir, { recursive: true });
  const runtime = {
    pack: await pullKnowledge(options.hubUrl),
    machineId: options.machineId,
    localDir: options.localDir
  };
  const socket = new WebSocket(agentSocketUrl(options.hubUrl));
  await new Promise((resolve, reject) => {
    let settled = false;
    let chain = Promise.resolve();
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error("Ba\u011Flant\u0131 koptu."));
    };
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "agent.hello", machineId: options.machineId, hostname: options.hostname }));
    });
    socket.addEventListener("message", (event) => {
      chain = chain.then(() => onMessage(runtime, String(event.data), (outbound) => socket.send(JSON.stringify(outbound)))).catch(fail);
    });
    socket.addEventListener("close", () => finish());
    socket.addEventListener("error", () => {
      if (socket.readyState === WebSocket.CONNECTING) fail(new Error("Merkeze ba\u011Flan\u0131lamad\u0131."));
    });
  });
}
async function onMessage(runtime, raw, send) {
  const message = JSON.parse(raw);
  const next = await handleHubMessage(runtime, message, { narrate: localModelNote });
  runtime.pack = next.runtime.pack;
  runtime.localDir = next.runtime.localDir;
  runtime.machineId = next.runtime.machineId;
  if (next.outbound) send(next.outbound);
}
async function connectLoop(options) {
  let delay = 1e3;
  for (; ; ) {
    try {
      console.log(`${options.hostname} merkeze ba\u011Flan\u0131yor. \u0130\u015F klas\xF6r\xFC: ${options.localDir}`);
      await connectOnce(options);
      delay = 1e3;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 15e3);
  }
}

// src/cli.ts
var hub = process.env.DENK_HUB_URL ?? "http://127.0.0.1:8788";
var command = process.argv[2];
if (!command || command === "connect") {
  const machineId = (process.env.DENK_MACHINE_ID || hostname()).replace(/[^\p{L}\p{N}_.:-]/gu, "-").slice(0, 80);
  const localDir = process.env.DENK_LOCAL || "inbox";
  await connectLoop({ hubUrl: hub, machineId, hostname: hostname(), localDir });
} else {
  const file = command === "process" ? process.argv[3] : command;
  if (!file) {
    console.error("Kullan\u0131m: npm run connect   veya   npm run process -- <evrak.xml>");
    process.exit(1);
  }
  const pack = await pullKnowledge(hub);
  const xml = await readFile3(file, "utf8");
  const result = processLocalEvrak(basename2(file), "application/xml", xml, pack);
  console.log(`bilgi ${pack.version} \xB7 ${pack.vatDescription} \xB7 ${pack.cashAccount}`);
  console.log(result.preview);
  if (result.blockers.length) {
    console.error(result.blockers.join("\n"));
    process.exit(2);
  }
}
