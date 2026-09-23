import { useEffect, useState } from "react";
import {
  FIELD_LABELS,
  OPERATOR_KEY,
  STATUS_LABELS,
  TENANT_KEY,
  VIEW_FIELDS,
  type HubState,
  type ViewField,
} from "./types.ts";

function readStore(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStore(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore quota */
  }
}

function pillClass(status: HubState["status"]): string {
  if (status === "ready") return "ok";
  if (status === "denied" || status === "expired" || status === "revoked") return "bad";
  if (status === "pending" || status === "prompted" || status === "granted") return "wait";
  return "";
}

export function View() {
  const [tenant, setTenant] = useState(() => readStore(TENANT_KEY));
  const [operator, setOperator] = useState(() => readStore(OPERATOR_KEY));
  const [once, setOnce] = useState<{ tenant: string; enrollCode: string; operatorKey: string } | null>(null);
  const [purpose, setPurpose] = useState("Fiş planı önizlemesi");
  const [fields, setFields] = useState<ViewField[]>([...VIEW_FIELDS]);
  const [state, setState] = useState<HubState | null>(null);
  const [packVersion, setPackVersion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function headers(): HeadersInit {
    return {
      "content-type": "application/json",
      "X-Denk-Tenant": tenant,
      "X-Denk-Operator": operator,
    };
  }

  useEffect(() => {
    fetch("/api/knowledge")
      .then((res) => res.json())
      .then((body: { pack?: { version?: string } }) => setPackVersion(body.pack?.version ?? ""))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!tenant || !operator) {
      setState(null);
      return;
    }
    let cancelled = false;
    async function pull(): Promise<void> {
      const res = await fetch(`/api/state?tenant=${encodeURIComponent(tenant)}`, { headers: headers() });
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
  }, [tenant, operator]);

  async function openOffice(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants", { method: "POST" });
      const body = (await res.json()) as {
        tenant?: string;
        enrollCode?: string;
        operatorKey?: string;
        error?: string;
      };
      if (!res.ok || !body.tenant || !body.enrollCode || !body.operatorKey) {
        throw new Error(body.error ?? "Büro açılamadı.");
      }
      writeStore(TENANT_KEY, body.tenant);
      writeStore(OPERATOR_KEY, body.operatorKey);
      setTenant(body.tenant);
      setOperator(body.operatorKey);
      setOnce({ tenant: body.tenant, enrollCode: body.enrollCode, operatorKey: body.operatorKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Büro açılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function post(path: string, body: unknown): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
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
  const bound = Boolean(tenant && operator);

  return (
    <div className="desk-ai">
      <section className="sheet">
        <h2>Büro</h2>
        <p className="lede">
          Evrak bu sunucuya yüklenmez. Önce büro açılır; ajan kayıt koduyla cihaz anahtarı alır.
          {packVersion ? ` Bilgi paketi ${packVersion}.` : ""}
        </p>
        <div className="row" style={{ marginTop: 0 }}>
          <button type="button" disabled={busy} onClick={() => void openOffice()}>
            Büro aç
          </button>
        </div>
        {tenant ? <p className="lede">Kiracı {tenant}</p> : null}
        {once ? (
          <div className="winbox">
            <p>Bu üç değer bir kez. Kaydet. Sayfa yenilenince kayıt kodu tekrar gelmez.</p>
            <p>Kiracı: {once.tenant}</p>
            <p>Kayıt kodu: {once.enrollCode}</p>
            <p>Operatör: {once.operatorKey}</p>
            <p>Ajan: npm run enroll -- {once.enrollCode}</p>
          </div>
        ) : null}
      </section>
      <section className="sheet">
        <h2>İzinli görünüm</h2>
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
          disabled={!bound || busy}
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
                disabled={!bound || busy}
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
            disabled={!bound || busy || !purpose.trim() || fields.length === 0}
            onClick={() => void post("/api/views/request", { purpose, fields })}
          >
            Görünüm iste
          </button>
          <button
            type="button"
            className="warn"
            disabled={!bound || busy || !state?.grant}
            onClick={() => void post("/api/views/revoke", { grantId: state?.grant?.grantId })}
          >
            Görünümü kapat
          </button>
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
