import type { UploadedDocument } from "./ubl.ts";

/** Cloudflare Workers AI model. Called only from our Worker via env.AI. */
export const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export const SYSTEM_PROMPT = [
  "Sen DENK AI’sın. Bu sohbet bizim Cloudflare Worker’ımızda çalışır (denk-app).",
  "Kullanıcı evrakı bizim sunucuya yükler; sen o evrakın çıkarılan alanlarını görürsün.",
  "Müşteri makinesine bağlanma. ETA SQL’ine bağlanma. SQL yazma. Parola isteme.",
  "Tutar uydurma: evrakta yoksa yok de. Hesaplama yapma, evraktaki rakamı kullan.",
  "Kanonik yazımlar: KDV satırı İND.KDV. (noktasız, boşluksuz). Nakit eşleşmezse 100 01.",
  "Alış faturası önerisi: 770 borç (gider), 191 02 20 İND.KDV. borç, 320 alacak (N.FT İLE ALIŞ).",
  "Kısa Türkçe cevap ver. Fiş yazdırmak için kullanıcıyı yazdır sayfasına yönlendir.",
].join(" ");

export function documentContext(doc: UploadedDocument | null): string {
  if (!doc) return "Yüklü evrak yok.";
  const lines = [
    `dosya=${doc.fileName}`,
    `tür=${doc.kind}`,
    `evrakNo=${doc.invoiceNo || "yok"}`,
    `tarih=${doc.issueDate || "yok"}`,
    `tedarikçi=${doc.supplierName || "yok"}`,
    `matrah=${doc.netText || "yok"}`,
    `kdv=${doc.vatText || "yok"}`,
    `ödenecek=${doc.payableText || "yok"}`,
  ];
  return `Yüklü evrak: ${lines.join("; ")}`;
}

export function buildChatMessages(
  userText: string,
  doc: UploadedDocument | null,
): Array<{ role: "system" | "user"; content: string }> {
  const asked = userText.trim() || "Yüklenen evrakı oku ve fiş öner.";
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `${documentContext(doc)}\n\nKullanıcı: ${asked}` },
  ];
}

export function extractModelText(result: unknown): string {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (!result || typeof result !== "object") return "";
  const row = result as Record<string, unknown>;
  for (const key of ["response", "result", "output_text", "text"]) {
    if (typeof row[key] === "string" && String(row[key]).trim()) return String(row[key]).trim();
  }
  if (row.result && typeof row.result === "object") {
    return extractModelText(row.result);
  }
  return "";
}
