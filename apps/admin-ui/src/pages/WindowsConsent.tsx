import { useEffect, useState } from "react";
import { denyView, grantView } from "../api.ts";
import { FIELD_LABELS } from "../labels.ts";
import type { HubSnapshot, ViewField } from "../types.ts";

export function WindowsConsent({ state }: { state: HubSnapshot }) {
  const waiting = state.status === "pending" || state.status === "prompted";
  const [chosen, setChosen] = useState<ViewField[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.request) setChosen([...state.request.fields]);
  }, [state.request]);

  function toggle(field: ViewField): void {
    setChosen((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  }

  return (
    <article className="cert">
      <h1>Windows oturumu ile onay</h1>
      <p className="lede">
        Canlıda bu sayfa ajanın yerelde açtığı penceredir. Parola sorulmaz ve sunucuya gitmez.
      </p>
      <div className="winbox">
        <div>Hesap: DEMO\Kullanici</div>
        <div>SID: S-1-5-21-DEMO-1001</div>
        <div>Oturum: etkileşimli</div>
      </div>
      {waiting && state.request ? (
        <>
          <p>
            DENK şunu görmek istiyor: <strong>{state.request.purpose}</strong>
          </p>
          <label className="block">Paylaşılacak alanlar</label>
          <div className="chips">
            {state.request.fields.map((field) => (
              <label key={field}>
                <input
                  type="checkbox"
                  checked={chosen.includes(field)}
                  onChange={() => toggle(field)}
                />
                {FIELD_LABELS[field]}
              </label>
            ))}
          </div>
          <div className="row">
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => {
                setError(null);
                grantView(chosen).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Onay gönderilemedi.");
                });
              }}
            >
              Windows oturumu ile onayla
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setError(null);
                denyView().catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Reddedilemedi.");
                });
              }}
            >
              Reddet
            </button>
          </div>
        </>
      ) : (
        <p className="empty">
          {state.status === "ready"
            ? "Onay verildi. Çalışma sayfasındaki tablo ajanın ittiği satırlardır."
            : state.status === "denied"
              ? "Bu istek reddedildi."
              : "Bekleyen izin yok. Operatör önce Çalışma’dan istek gönderir."}
        </p>
      )}
      {error ? <p className="lede">{error}</p> : null}
    </article>
  );
}
