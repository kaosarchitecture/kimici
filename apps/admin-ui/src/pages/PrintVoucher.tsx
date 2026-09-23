import { PRINT_VOUCHER } from "../voucher.ts";

export function PrintVoucher() {
  return (
    <div className="print-wrap">
      <div className="print-bar no-print">
        <p>
          Bu fiş bu sunucuda yazıldı. Başka bir bilgisayar bu sayfayı açıp yazdırabilir.
          ETA SQL’ine bağlanılmaz.
        </p>
        <button type="button" onClick={() => window.print()}>
          Fişi yazdır
        </button>
      </div>

      <article className="fis" id="fis-kagit">
        <header className="fis-head">
          <div>
            <p className="fis-co">{PRINT_VOUCHER.company}</p>
            <h1>Muhasebe fişi</h1>
          </div>
          <dl>
            <div>
              <dt>Fiş no</dt>
              <dd>{PRINT_VOUCHER.number}</dd>
            </div>
            <div>
              <dt>Tarih</dt>
              <dd>{PRINT_VOUCHER.date}</dd>
            </div>
            <div>
              <dt>Tür</dt>
              <dd>{PRINT_VOUCHER.kind}</dd>
            </div>
          </dl>
        </header>
        <p className="fis-note">{PRINT_VOUCHER.note}</p>
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
            {PRINT_VOUCHER.lines.map((line) => (
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
          <span>Borç {PRINT_VOUCHER.debit}</span>
          <span>Alacak {PRINT_VOUCHER.credit}</span>
          <span>Fark 0,00</span>
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
