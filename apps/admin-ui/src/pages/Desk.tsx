import { useEffect, useState } from "react";
import type { Evrak } from "./types.ts";

interface Message {
  who: "ai" | "user";
  text: string;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

interface AiLink {
  connected: boolean;
  model: string;
  via: string;
  where: string;
}

export function Desk() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<AiLink | null>(null);
  const [doc, setDoc] = useState<Evrak | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      who: "ai",
      text: "DENK AI (Grok). Konuşma denk-app’den xAI’ye gider; model xai.env içinden seçilir. Evrakı yükleyin. SQL yazmam; müşteri makinesine bağlanmam.",
    },
  ]);

  useEffect(() => {
    fetch("/api/ai")
      .then((res) => res.json())
      .then((body: AiLink) => setLink(body))
      .catch(() => setLink({ connected: false, model: "", via: "disconnected", where: "" }));
    fetch("/api/evrak")
      .then((res) => res.json())
      .then(async (body: { document?: Evrak | null }) => {
        if (!body.document) return;
        setDoc(body.document);
        const reply = await ask("", body.document);
        setMessages((current) => [...current, { who: "ai", text: reply }]);
      })
      .catch(() => undefined);
  }, []);

  async function ask(message: string, evrak = doc): Promise<string> {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, document: evrak }),
    });
    const body = (await res.json()) as { reply?: string; error?: string };
    if (!res.ok) throw new Error(body.error ?? "AI cevap veremedi.");
    return body.reply ?? "";
  }

  async function sendFile(file: File): Promise<void> {
    setBusy(true);
    setError(null);
    setMessages((current) => [...current, { who: "user", text: `Evrak yükledim: ${file.name}` }]);
    try {
      const contentBase64 = await fileToBase64(file);
      const res = await fetch("/api/evrak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mime: file.type, contentBase64 }),
      });
      const body = (await res.json()) as { document?: Evrak; error?: string };
      if (!res.ok || !body.document) throw new Error(body.error ?? "Yüklenemedi.");
      setDoc(body.document);
      const reply = await ask("özet", body.document);
      setMessages((current) => [...current, { who: "ai", text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function sendText(): Promise<void> {
    const message = draft.trim();
    if (!message) return;
    setDraft("");
    setMessages((current) => [...current, { who: "user", text: message }]);
    setBusy(true);
    try {
      const reply = await ask(message);
      setMessages((current) => [...current, { who: "ai", text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI cevap veremedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desk-ai">
      <section className="sheet">
        <h2>AI</h2>
        <p className="lede">
          {link?.connected
            ? `Bağlı: ${link.model} · ${link.via}`
            : "Model bağlı değil. denk-app Worker’ını Cloudflare’e yükleyin (env.AI binding)."}
        </p>
        <div className="thread">
          {messages.map((message, index) => (
            <div key={index} className={`msg ${message.who === "ai" ? "ai" : "op"}`}>
              <small>{message.who === "ai" ? "DENK AI" : "Siz"}</small>
              {message.text}
            </div>
          ))}
        </div>
        <label className="drop">
          <input
            type="file"
            accept=".xml,.pdf,.xlsx,.xls,.jpg,.jpeg,.png"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void sendFile(file);
            }}
          />
          <strong>{busy ? "İşleniyor…" : "Evrak yükle"}</strong>
          <span>Gerçek dosya · XML, PDF, Excel veya görüntü · en fazla 5 MB</span>
        </label>
        <label className="block" htmlFor="ai-input">AI’ye yazın</label>
        <textarea
          id="ai-input"
          rows={2}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendText();
            }
          }}
        />
        <div className="row">
          <button type="button" disabled={busy || !draft.trim()} onClick={() => void sendText()}>
            Gönder
          </button>
          <a className="as-btn ghost" href="#/yazdir">
            Fişi yazdır
          </a>
        </div>
        {error ? <p className="lede">{error}</p> : null}
        {doc ? (
          <p className="lede">
            Son evrak: {doc.fileName}
            {doc.invoiceNo ? ` · ${doc.invoiceNo}` : ""}
            {doc.payableText ? ` · ${doc.payableText}` : ""}
          </p>
        ) : null}
      </section>
    </div>
  );
}
