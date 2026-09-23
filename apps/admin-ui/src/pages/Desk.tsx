import { useEffect, useState } from "react";
import { deskSocketUrl, loadDesk, runOnMachine, type DeskSnapshot, type MachineView } from "../desk-api.ts";

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
        <p className="lede">İndirilen dosyayı çalıştır. Windows onayı bu bilgisayarda sorulur.</p>
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
      <p className="lede">{job?.windowsAccount ? `Windows: ${job.windowsAccount}` : "Windows onayı yok."}</p>
      {job?.read ? (
        <>
          <p className="lede">{job.read.databases.length > 0 ? `SQL: ${job.read.databases.join(", ")}` : "SQL yok."}</p>
          <p className="lede">{job.read.companies.length > 0 ? `ETA: ${job.read.companies.join(", ")}` : "ETA yok."}</p>
          <p className="lede">{job.eta?.build === "open" ? "Build açık." : "Build kapalı."}</p>
          {job.read.vouchers.map((voucher) => (
            <p key={`${voucher.company}-${voucher.voucherNo}`} className="lede">
              {voucher.company} · {voucher.voucherNo} · {voucher.date} · {voucher.debit} / {voucher.credit}
            </p>
          ))}
          {job.read.files.length > 0 ? <p className="lede">{job.read.files.join(", ")}</p> : null}
        </>
      ) : null}
      <p className="lede">{job?.note ?? "Windows onayı gelince bu bilgisayardaki SQL ve ETA açılır."}</p>
      <div className="row">
        <button type="button" disabled={props.busy || !props.machine.online || !job?.windowsAccount} onClick={props.onRun}>
          {props.busy || job?.status === "running" ? "Bu bilgisayarda açılıyor…" : "Bu bilgisayarda aç"}
        </button>
      </div>
    </>
  );
}
