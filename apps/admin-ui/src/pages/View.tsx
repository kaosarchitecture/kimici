import { useEffect, useState } from "react";
import { FIELD_LABELS, STATUS_LABELS, TENANT_KEY, VIEW_FIELDS, type HubState, type ViewField } from "./types.ts";

function loadTenant(): string {
  try {
    return localStorage.getItem(TENANT_KEY) ?? "";
  } catch {
    return "";
  }
}

function pillClass(status: HubState["status"]): string {
  if (status === "ready") return "ok";
  if (status === "denied" || status === "expired" || status === "revoked") return "bad";
  if (status === "pending" || status === "prompted" || status === "granted") return "wait";
  return "";
}

export function View() {
  const [tenantDraft, setTenantDraft] = useState(loadTenant);
  const [tenant, setTenant] = useState(loadTenant);
  const [purpose, setPurpose] = useState("Fiş planı önizlemesi");
  const [fields, setFields] = useState<ViewField[]>([...VIEW_FIELDS]);
  const [state, setState] = useState<HubState | null>(null);
  const [packVersion, setPackVersion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function applyTenant(): void {
    const next = tenantDraft.trim().toLowerCase();
    setTenant(next);
    try {
      localStorage.setItem(TENANT_KEY, next);
    } catch {
      /* ignore quota */
    }
  }

  useEffect(() => {
    fetch("/api/knowledge")
      .then((res) => res.json())
      .then((body: { pack?: { version?: string } }) => setPackVersion(body.pack?.version ?? ""))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!tenant) {
      setState(null);
      return;
    }
    let cancelled = false;
    async function pull(): Promise<void> {
      const res = await fetch(`/api/state?tenant=${encodeURIComponent(tenant)}`, {
        headers: { "X-Denk-Tenant": tenant },
      });
      const body = (await res.json()) as HubState & { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? "Durum okunamadı.");
        setState(null);
        return;
      }
      setError(null);
      setState(body);
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tenant]);

  async function post(path: string, body: unknown): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Denk-Tenant": tenant },
        body: JSON.stringify(body),
      });
      const next = (await res.json()) as HubState & { error?: string };
      if (!res.ok) throw new Error(next.error ?? "İstek başarısız.");
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İstek başarısız.");
    } finally {
      setBusy(false);
    }
  }

  const columns = state?.view?.fieldSet ?? fields;
  const records = state?.view?.records ?? [];

  return (
    <div className="desk-ai">
      <section className="sheet">
        <h2>İzinli görünüm</h2>
        <p className="lede">
          Evrak bu sunucuya yüklenmez. Windows ajanı onaydan sonra yalnız tiklenen alanları iter.
          {packVersion ? ` Bilgi paketi ${packVersion}.` : ""}
        </p>
        <label className="block" htmlFor="tenant">
          Kiracı kodu
        </label>
        <div className="row" style={{ marginTop: 0 }}>
          <input
            id="tenant"
            type="text"
            value={tenantDraft}
            autoComplete="off"
            onChange={(event) => setTenantDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyTenant();
            }}
          />
          <button type="button" onClick={applyTenant} disabled={!tenantDraft.trim()}>
            Bağlan
          </button>
        </div>
        {state ? (
          <p className="lede">
            <span className={`pill ${pillClass(state.status)}`}>{STATUS_LABELS[state.status]}</span>
            {state.grant ? ` · ${state.grant.identity.account}` : ""}
            {state.denyReason ? ` · ${state.denyReason}` : ""}
          </p>
        ) : null}
        <label className="block" htmlFor="purpose">
          Gerekçe
        </label>
        <input
          id="purpose"
          type="text"
          value={purpose}
          disabled={!tenant || busy}
          onChange={(event) => setPurpose(event.target.value)}
        />
        <p className="block" style={{ marginBottom: 0 }}>
          İstenen alanlar
        </p>
        <div className="chips">
          {VIEW_FIELDS.map((field) => (
            <label key={field}>
              <input
                type="checkbox"
                checked={fields.includes(field)}
                disabled={!tenant || busy}
                onChange={(event) => {
                  setFields((current) =>
                    event.target.checked ? [...current, field] : current.filter((item) => item !== field),
                  );
                }}
              />
              {FIELD_LABELS[field]}
            </label>
          ))}
        </div>
        <div className="row">
          <button
            type="button"
            disabled={!tenant || busy || !purpose.trim() || fields.length === 0}
            onClick={() => void post("/api/views/request", { purpose, fields })}
          >
            Görünüm iste
          </button>
          <button
            type="button"
            className="warn"
            disabled={!tenant || busy || !state?.grant}
            onClick={() => void post("/api/views/revoke", { grantId: state?.grant?.grantId })}
          >
            Görünümü kapat
          </button>
          <a className="as-btn ghost" href="#/yazdir">
            Fişi yazdır
          </a>
        </div>
        {error ? <p className="lede">{error}</p> : null}
      </section>
      <section className="sheet">
        <h2>İtilen satırlar</h2>
        {records.length === 0 ? (
          <p className="empty">Henüz izinli satır yok. Ajan bu makinede evrakı işler, sonra buraya iter.</p>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                {columns.map((field) => (
                  <th key={field}>{FIELD_LABELS[field]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((row, index) => (
                <tr key={index} className={row.description === "İND.KDV." ? "vat" : undefined}>
                  {columns.map((field) => (
                    <td key={field} className={field === "amountText" ? "num" : undefined}>
                      {row[field] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
