import type { UploadedDocument } from "./ubl.ts";

/** xAI chat model id (https://api.x.ai/v1/chat/completions). */
export const XAI_MODEL = "grok-4.5";

/** Cloudflare AI Gateway / env.AI.run model id. */
export const CF_GROK_MODEL = "xai/grok-4.5";

export const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const SYSTEM_PROMPT = [
  "Sen DENK AI’sın (Grok 4.5). Bu sohbet bizim denk-app Worker’ımızda çalışır.",
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

export function buildChatMessages(userText: string, doc: UploadedDocument | null): ChatMessage[] {
  const asked = userText.trim() || "Yüklenen evrakı oku ve fiş öner.";
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `${documentContext(doc)}\n\nKullanıcı: ${asked}` },
  ];
}

export function xaiChatBody(messages: ChatMessage[]): Record<string, unknown> {
  return {
    model: XAI_MODEL,
    messages,
    reasoning_effort: "medium",
  };
}

function textFromContent(content: unknown): string {
  if (typeof content === "string" && content.trim()) return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
      return "";
    })
    .join("")
    .trim();
}

export function extractModelText(result: unknown): string {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (!result || typeof result !== "object") return "";
  const row = result as Record<string, unknown>;
  if (Array.isArray(row.choices) && row.choices[0] && typeof row.choices[0] === "object") {
    const choice = row.choices[0] as Record<string, unknown>;
    const message = choice.message;
    if (message && typeof message === "object") {
      const fromMsg = textFromContent((message as { content?: unknown }).content);
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

export async function runXaiChat(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(xaiChatBody(messages)),
  });
  const payload = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(payload.error?.message ?? `xAI HTTP ${res.status}`);
  }
  const reply = extractModelText(payload);
  if (!reply) throw new Error("Grok 4.5 boş cevap verdi.");
  return reply;
}
