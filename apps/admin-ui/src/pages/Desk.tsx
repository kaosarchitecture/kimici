import { useEffect, useState } from "react";
import { approveMachine, deskSocketUrl, loadDesk, runOnMachine, type DeskSnapshot, type MachineView } from "../desk-api.ts";

const STATUS: Record<string, string> = {
  pending: "Onay bekliyor",
  running: "İşleniyor",
  done: "Tamam",
  empty: "Kayıt yok",
  blocked: "Durdu",
  dropped: "Bağlantı koptu",
  failed: "Hata",
};

function pairingFromHash(): { machineId: string; code: string } | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const machineId = params.get("makine")?.trim() ?? "";
  const code = params.get("onay")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(code) || !machineId) return null;
  return { machineId, code };
}

export function Desk() {
  const [desk, setDesk] = useState<DeskSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState(pairingFromHash);
  const [linked, setLinked] = useState(false);

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
  const waiting = pairing ? desk?.machines.find((row) => row.machineId === pairing.machineId) ?? null : null;

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

  async function link(): Promise<void> {
    if (!pairing) return;
    setBusy(true);
    setError(null);
    try {
      await approveMachine(pairing.machineId, pairing.code);
      setLinked(true);
      setPairing(null);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={machine || pairing ? "desk" : "desk solo"}>
      <section className="sheet">
        <a className="as-btn" href="/denk-baglan/Baglan.cmd" download="Baglan.cmd">
          Bu bilgisayarı bağla
        </a>
        <p className="lede">Dosyayı çalıştırın. PowerShell bu sayfayı açar. Bağla'ya basın.</p>
        {desk && desk.machines.length === 0 && !pairing ? <p className="empty">Bağlı bilgisayar yok.</p> : null}
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
      {pairing ? (
        <section className="sheet">
          <h2>{pairing.machineId} bağlanmak istiyor</h2>
          <p className="lede">
            {waiting?.lastJob?.windowsAccount ? `Windows: ${waiting.lastJob.windowsAccount}` : "Bilgisayar bağlanıyor."}
          </p>
          <p className="lede">Bu bilgisayar bu masaya bağlanacak.</p>
          <div className="row">
            <button type="button" disabled={busy || !waiting?.online} onClick={() => void link()}>
              {busy ? "Bağlanıyor…" : "Bağla"}
            </button>
          </div>
        </section>
      ) : null}
      {linked ? (
        <section className="sheet">
          <h2>Bağlandı</h2>
          <p className="lede">Onay bu sayfadan verildi. Okuma o bilgisayarda sürer.</p>
        </section>
      ) : null}
      {machine && !pairing ? (
        <section className="sheet">
          <h2>{machine.machineId}</h2>
          <MachineResult machine={machine} rulesVersion={desk?.rulesVersion ?? ""} busy={busy} onRun={() => void run(machine)} />
        </section>
      ) : null}
    </div>
  );
}

function MachineResult(props: { machine: MachineView; rulesVersion: string; busy: boolean; onRun: () => void }) {
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
            <article key={`${voucher.company}-${voucher.voucherNo}`} className="voucher">
              <h3>
                {voucher.voucherNo} · {voucher.company}
                {voucher.kind ? ` · ${voucher.kind}` : ""}
              </h3>
              <p className="lede">
                Fiş sürümü {voucher.version || "—"} · Kural sürümü {props.rulesVersion || "—"} · {voucher.date} · borç {voucher.debit} · alacak {voucher.credit}
              </p>
              {voucher.lines.length > 0 ? (
                <table className="ledger">
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
                      <tr key={`${voucher.voucherNo}-${line.seq}-${line.account}`}>
                        <td>{line.seq}</td>
                        <td>{line.account}</td>
                        <td>{line.side}</td>
                        <td className="num">{line.amount}</td>
                        <td>{line.description}</td>
                        <td>{line.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </article>
          ))}
          {job.read.files.length > 0 ? <p className="lede">{job.read.files.join(", ")}</p> : null}
        </>
      ) : null}
      {job?.modelNote ? <p className="lede">xAI: {job.modelNote}</p> : null}
      <p className="lede">{job?.note ?? "Windows onayı gelince bu bilgisayardan okunan fişler burada açılır."}</p>
      <div className="row">
        <button type="button" disabled={props.busy || !props.machine.online || !job?.windowsAccount || job?.status === "pending"} onClick={props.onRun}>
          {props.busy || job?.status === "running" ? "Bu bilgisayarda açılıyor…" : "Bu bilgisayarda aç"}
        </button>
      </div>
    </>
  );
}
