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
        if (!stop) setError("Liste alınamadı.");
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
    <div className={machine ? "desk" : "desk solo"}>
      <section className="sheet">
        <a className="as-btn" href="/denk-baglan/Baglan.cmd" download="Baglan.cmd">
          Bu bilgisayarı bağla
        </a>
        <p className="lede">İndirilen dosyayı çalıştır. Kayıtlar C:\DENK\inbox içine konur. Fiş burada görünür.</p>
        {desk && desk.machines.length === 0 ? <p className="empty">Bağlı bilgisayar yok.</p> : null}
        <div className="machines">
          {desk?.machines.map((row) => (
            <button
              key={row.machineId}
              type="button"
              className={machine?.machineId === row.machineId ? "machine active" : "machine"}
              onClick={() => setSelected(row.machineId)}
            >
              <span>
                <strong>{row.machineId}</strong>
                <small>{row.online ? "bağlı" : "bağlı değil"}{row.hostname !== row.machineId ? ` · ${row.hostname}` : ""}</small>
              </span>
              <em className={row.online ? "pill ok" : "pill"}>{row.lastJob ? STATUS[row.lastJob.status] : "bekliyor"}</em>
            </button>
          ))}
        </div>
        {error ? <p className="lede">{error}</p> : null}
      </section>
      {machine ? (
        <section className="sheet">
          <h2>{machine.machineId}</h2>
          <MachineResult machine={machine} busy={busy} onRun={() => void run(machine)} />
        </section>
      ) : null}
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
      {job?.modelNote ? <p className="preview">{job.modelNote}</p> : null}
    </>
  );
}
