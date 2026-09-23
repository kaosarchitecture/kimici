import { useEffect, useState } from "react";
import { loadDesk, PRINT_MACHINE_KEY, type DeskVoucher, type MachineView } from "../desk-api.ts";

function trDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function PrintVoucher() {
  const [machine, setMachine] = useState<MachineView | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const wanted = sessionStorage.getItem(PRINT_MACHINE_KEY);
    loadDesk()
      .then((desk) => {
        const found = desk.machines.find((row) => row.machineId === wanted) ?? desk.machines.find((row) => row.lastJob && row.lastJob.vouchers.length > 0) ?? null;
        if (!found || !found.lastJob || found.lastJob.vouchers.length === 0) setMissing(true);
        else setMachine(found);
      })
      .catch(() => setMissing(true));
  }, []);

  const vouchers = machine?.lastJob?.vouchers ?? [];
  if (!machine || vouchers.length === 0) {
    return (
      <section className="sheet" style={{ maxWidth: 520 }}>
        <p className="empty">{missing ? "Yazdırılacak fiş yok. Önce bir bilgisayar bağlanıp kendi klasörünü işlemeli." : "Yükleniyor…"}</p>
        <a className="as-btn" href="#/">
          Bilgisayarlara dön
        </a>
      </section>
    );
  }

  return (
    <div className="print-wrap">
      <div className="print-bar no-print">
        <p>
          {machine.hostname} üzerinde kurulan fiş. Kaynak dosya bu sunucuya gelmedi.
        </p>
        <div className="row" style={{ marginTop: 0 }}>
          <a className="as-btn ghost" href="#/">
            Bilgisayarlar
          </a>
          <button type="button" onClick={() => window.print()}>
            Fişi yazdır
          </button>
        </div>
      </div>
      {vouchers.map((voucher) => (
        <Slip key={`${voucher.sourceName}-${voucher.invoiceNo}`} voucher={voucher} hostname={machine.hostname} />
      ))}
    </div>
  );
}

function Slip(props: { voucher: DeskVoucher; hostname: string }) {
  const voucher = props.voucher;
  return (
    <article className="fis" id="fis-kagit">
      <header className="fis-head">
        <div>
          <p className="fis-co">{props.hostname}</p>
          <h1>Muhasebe fişi</h1>
        </div>
        <dl>
          <div>
            <dt>Fiş no</dt>
            <dd>{voucher.invoiceNo || "—"}</dd>
          </div>
          <div>
            <dt>Tarih</dt>
            <dd>{trDate(voucher.date) || "—"}</dd>
          </div>
          <div>
            <dt>Tür</dt>
            <dd>{voucher.sourceKind}</dd>
          </div>
        </dl>
      </header>
      <p className="fis-note">{voucher.supplierName || voucher.sourceName}</p>
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
              <td>{trDate(line.date)}</td>
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
  );
}
