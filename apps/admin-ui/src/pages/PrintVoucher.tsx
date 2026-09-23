import { useEffect, useState } from "react";
import { voucherFromEvrak, type PrintVoucher as Voucher } from "../voucher.ts";
import type { Evrak } from "./types.ts";

export function PrintVoucher() {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch("/api/evrak")
      .then((res) => res.json())
      .then((body: { document?: Evrak | null }) => {
        if (body.document) setVoucher(voucherFromEvrak(body.document));
        else setMissing(true);
      })
      .catch(() => setMissing(true));
  }, []);

  if (!voucher) {
    return (
      <section className="sheet" style={{ maxWidth: 520 }}>
        <p className="empty">{missing ? "Yazdırılacak evrak yok. Önce AI sayfasından gerçek bir dosya yükleyin." : "Yükleniyor…"}</p>
        <a className="as-btn" href="#/">
          AI’ye dön
        </a>
      </section>
    );
  }

  return (
    <div className="print-wrap">
      <div className="print-bar no-print">
        <p>Bu fiş yüklenen evraktan üretildi. ETA SQL’ine bağlanılmaz.</p>
        <div className="row" style={{ marginTop: 0 }}>
          <a className="as-btn ghost" href="#/">
            AI
          </a>
          <button type="button" onClick={() => window.print()}>
            Fişi yazdır
          </button>
        </div>
      </div>
      <article className="fis" id="fis-kagit">
        <header className="fis-head">
          <div>
            <p className="fis-co">{voucher.company || voucher.note}</p>
            <h1>Muhasebe fişi</h1>
          </div>
          <dl>
            <div>
              <dt>Fiş no</dt>
              <dd>{voucher.number || "—"}</dd>
            </div>
            <div>
              <dt>Tarih</dt>
              <dd>{voucher.date || "—"}</dd>
            </div>
            <div>
              <dt>Tür</dt>
              <dd>{voucher.kind}</dd>
            </div>
          </dl>
        </header>
        <p className="fis-note">{voucher.note}</p>
        <table>
          <thead>
            <tr>
              <th>Sıra</th>
              <th>Hesap</th>
              <th>B/A</th>
              <th>Tutar</th>
              <th>Açıklama</th>
              <th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line) => (
              <tr key={line.seq} className={line.description === "İND.KDV." ? "vat" : undefined}>
                <td>{line.seq}</td>
                <td>{line.account}</td>
                <td>{line.side}</td>
                <td className="num">{line.amountText}</td>
                <td>{line.description}</td>
                <td>{line.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="fis-foot">
          <span>Borç {voucher.debit || "—"}</span>
          <span>Alacak {voucher.credit || "—"}</span>
        </footer>
        <div className="fis-sign">
          <span>Düzenleyen</span>
          <span>Kontrol</span>
          <span>Onay</span>
        </div>
      </article>
    </div>
  );
}
