import { useEffect, useState } from "react";
import { deskSocketUrl, loadDesk, PRINT_MACHINE_KEY, runOnMachine, type DeskSnapshot, type MachineView } from "../desk-api.ts";

const STATUS: Record<string, string> = {
  running: "İşleniyor",
  done: "Tamam",
  empty: "Kayıt yok",
  blocked: "Durdu",
  dropped: "Bağlantı koptu",
  failed: "Hata",
};

export function Desk() {
  const [desk, setDesk] = useState<DeskSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    const apply = (next: DeskSnapshot) => {
      if (stop) return;
      setDesk(next);
      setError(null);
      setSelected((current) => current ?? next.machines[0]?.machineId ?? null);
    };
    const pull = () => {
      loadDesk().then(apply).catch(() => {
        if (!stop) setError("Merkez kapalı. denk-app bu makinede 8788 portunda açık olmalı.");
      });
    };
    pull();
    const timer = window.setInterval(pull, 4000);
    const socket = new WebSocket(deskSocketUrl());
    socket.addEventListener("message", (event) => {
      try {
        apply(JSON.parse(String(event.data)) as DeskSnapshot);
      } catch {
        // Ignore a malformed socket frame.
      }
    });
    return () => {
      stop = true;
      window.clearInterval(timer);
      socket.close();
    };
  }, []);

  const machine = desk?.machines.find((row) => row.machineId === selected) ?? desk?.machines[0] ?? null;

  async function run(row: MachineView): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await runOnMachine(row.machineId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başlatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="lede">{desk?.where ?? "Kurallar bulutta. İşlem bağlanan bilgisayarda."}</p>
      {desk ? (
        <p className="lede">
          Kural {desk.rulesVersion}: {desk.vatDescription} · nakit {desk.cashAccount} · KDV {desk.vatAccount} · gider{" "}
          {desk.expenseAccount}
        </p>
      ) : null}
      <div className="desk">
        <section className="sheet">
          <h2>Bağlanan bilgisayarlar</h2>
          {desk && desk.machines.length === 0 ? (
            <p className="empty">
              Henüz bağlanan bilgisayar yok. İşlem yapılacak makinede ajanı açın. Kurallar buradan iner; o makinedeki log,
              audit ve XML orada işlenir.
            </p>
          ) : null}
          <div className="machines">
            {desk?.machines.map((row) => (
              <button
                key={row.machineId}
                type="button"
                className={machine?.machineId === row.machineId ? "machine active" : "machine"}
                onClick={() => setSelected(row.machineId)}
              >
                <span>
                  <strong>{row.hostname}</strong>
                  <small>{row.online ? "bağlı" : "bağlı değil"}</small>
                </span>
                <em className={row.online ? "pill ok" : "pill"}>{row.lastJob ? STATUS[row.lastJob.status] : "bekliyor"}</em>
              </button>
            ))}
          </div>
          <p className="lede">O makinede: DENK_LOCAL klasörüyle npm run connect</p>
        </section>
        <section className="sheet">
          <h2>{machine ? machine.hostname : "Fiş"}</h2>
          {machine ? <MachineResult machine={machine} busy={busy} onRun={() => void run(machine)} /> : <p className="empty">Bilgisayar seçilmedi.</p>}
          {error ? <p className="lede">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}

function MachineResult(props: { machine: MachineView; busy: boolean; onRun: () => void }) {
  const job = props.machine.lastJob;
  return (
    <>
      <p className="lede">{job?.note ?? "Bağlanınca bu bilgisayar kendi klasörünü işler."}</p>
      <div className="row">
        <button type="button" disabled={props.busy || !props.machine.online} onClick={props.onRun}>
          {props.busy || job?.status === "running" ? "Bu bilgisayarda işleniyor…" : "Bu bilgisayarda işle"}
        </button>
        {job && job.vouchers.length > 0 ? (
          <a
            className="as-btn ghost"
            href="#/yazdir"
            onClick={() => sessionStorage.setItem(PRINT_MACHINE_KEY, props.machine.machineId)}
          >
            Fişi yazdır
          </a>
        ) : null}
      </div>
      {job?.vouchers.map((voucher) => (
        <article key={`${voucher.sourceName}-${voucher.invoiceNo}`} className="voucher">
          <h3>
            {voucher.invoiceNo || voucher.sourceName} · {voucher.sourceKind}
          </h3>
          <p className="lede">
            {voucher.supplierName || "Unvan yok"} · {voucher.date} · kaynak {voucher.sourceName}
          </p>
          <table className="ledger">
            <thead>
              <tr>
                <th>Sıra</th>
                <th>Hesap</th>
                <th>B/A</th>
                <th>Tutar</th>
                <th>Açıklama</th>
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
                </tr>
              ))}
            </tbody>
          </table>
          {voucher.blockers.length > 0 ? <p className="lede">{voucher.blockers.join(" ")}</p> : null}
        </article>
      ))}
      {job?.modelNote ? (
        <p className="preview">
          Bu bilgisayardaki model: {job.modelNote}
        </p>
      ) : (
        <p className="lede">Tutarları kural motoru kurar. Model varsa yalnız bu bilgisayarda değerlendirme yazar.</p>
      )}
    </>
  );
}
