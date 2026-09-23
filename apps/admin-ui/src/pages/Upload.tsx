import { useEffect, useState } from "react";

export interface Evrak {
  fileName: string;
  mime: string;
  size: number;
  receivedAt: string;
  kind: "ubl-invoice" | "file";
  invoiceNo: string;
  issueDate: string;
  supplierName: string;
  netText: string;
  vatText: string;
  payableText: string;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function Upload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Evrak | null>(null);

  useEffect(() => {
    fetch("/api/evrak")
      .then((res) => res.json())
      .then((body: { document?: Evrak | null }) => setDoc(body.document ?? null))
      .catch(() => undefined);
  }, []);

  async function send(file: File): Promise<void> {
    setBusy(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sheet" style={{ maxWidth: 640 }}>
      <h2>Evrakı buraya verin</h2>
      <p className="lede">
        Evrak bu sunucuya gelir: karşıdaki bilgisayar dosyayı yükler (e-fatura XML, PDF, Excel,
        fotoğraf). Biz ofis makinesinden çekmeyiz. Portal veya ajan sonra eklenebilir.
      </p>
      <label className="drop">
        <input
          type="file"
          accept=".xml,.pdf,.xlsx,.xls,.jpg,.jpeg,.png"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void send(file);
          }}
        />
        <strong>{busy ? "Yükleniyor…" : "Evrak yükle"}</strong>
        <span>XML, PDF, Excel veya görüntü · en fazla 5 MB</span>
      </label>
      {error ? <p className="lede">{error}</p> : null}
      {doc ? (
        <div className="facts" style={{ marginTop: "1rem" }}>
          <div>
            <dt>Dosya</dt>
            <dd>{doc.fileName}</dd>
          </div>
          <div>
            <dt>Kaynak</dt>
            <dd>{doc.kind === "ubl-invoice" ? "UBL e-fatura (yükleme)" : "Yüklenen dosya"}</dd>
          </div>
          {doc.invoiceNo ? (
            <div>
              <dt>Evrak no</dt>
              <dd>{doc.invoiceNo}</dd>
            </div>
          ) : null}
          {doc.supplierName ? (
            <div>
              <dt>Tedarikçi</dt>
              <dd>{doc.supplierName}</dd>
            </div>
          ) : null}
          {doc.payableText ? (
            <div>
              <dt>Ödenecek</dt>
              <dd>{doc.payableText}</dd>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="row">
        <a className="as-btn" href="#/yazdir">
          Fişi yazdır
        </a>
      </div>
    </section>
  );
}
