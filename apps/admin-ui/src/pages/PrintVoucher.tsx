import { useEffect, useState } from "react";
import { PRINT_VOUCHER, voucherFromEvrak, type PrintVoucher as Voucher } from "../voucher.ts";
import type { Evrak } from "./Upload.tsx";

export function PrintVoucher() {
  const [voucher, setVoucher] = useState<Voucher>(PRINT_VOUCHER);
  const [fromUpload, setFromUpload] = useState(false);

  useEffect(() => {
    fetch("/api/evrak")
      .then((res) => res.json())
      .then((body: { document?: Evrak | null }) => {
        if (body.document) {
          setVoucher(voucherFromEvrak(body.document));
          setFromUpload(true);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="print-wrap">
      <div className="print-bar no-print">
        <p>
          {fromUpload
            ? "Bu fiş yüklenen evraktan üretildi. ETA SQL’ine bağlanılmaz."
            : "Henüz evrak yok. Önce ana sayfadan yükleyin; yoksa örnek fiş yazdırılır."}
        </p>
        <div className="row" style={{ marginTop: 0 }}>
          <a className="as-btn ghost" href="#/">
            Evrak yükle
          </a>
          <button type="button" onClick={() => window.print()}>
            Fişi yazdır
          </button>
        </div>
      </div>

      <article className="fis" id="fis-kagit">
        <header className="fis-head">
          <div>
            <p className="fis-co">{voucher.company}</p>
            <h1>Muhasebe fişi</h1>
          </div>
          <dl>
            <div>
              <dt>Fiş no</dt>
              <dd>{voucher.number}</dd>
            </div>
            <div>
              <dt>Tarih</dt>
              <dd>{voucher.date}</dd>
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
          <span>Borç {voucher.debit}</span>
          <span>Alacak {voucher.credit}</span>
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
