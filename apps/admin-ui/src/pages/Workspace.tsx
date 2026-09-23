import { useMemo, useState } from "react";
import { requestView, revokeView } from "../api.ts";
import { LedgerTable } from "../components/LedgerTable.tsx";
import { FIELD_LABELS } from "../labels.ts";
import type { HubSnapshot, ViewField } from "../types.ts";
import { VIEW_FIELDS } from "../types.ts";

export function Workspace({ state }: { state: HubSnapshot }) {
  const [purpose, setPurpose] = useState("Ağustos alış faturası önizlemesi");
  const [asked, setAsked] = useState<ViewField[]>([...VIEW_FIELDS]);
  const [error, setError] = useState<string | null>(null);

  const waiting = state.status === "pending" || state.status === "prompted";
  const hasView = Boolean(state.view && state.grant);

  const messages = useMemo(() => {
    const out: { who: string; text: string; kind: "ai" | "op" }[] = [
      {
        who: "AI",
        kind: "ai",
        text: "Görmek istediğiniz fişi yazın. Ben makineye bağlanmam; Windows onayı isterim, ajan izinli satırları iter.",
      },
    ];
    if (state.request) {
      out.push({
        who: "Operatör",
        kind: "op",
        text: purpose || state.request.purpose,
      });
      out.push({
        who: "AI",
        kind: "ai",
        text: `İzin istedim: ${state.request.purpose}. Kullanıcının Windows oturumu onaylamadan tablo boş kalır.`,
      });
    }
    if (state.status === "denied") {
      out.push({ who: "AI", kind: "ai", text: state.denyReason ?? "Kullanıcı reddetti." });
    }
    if (state.status === "ready" && state.grant) {
      out.push({
        who: "AI",
        kind: "ai",
        text: `${state.grant.identity.account} onayladı. Aşağıda yalnız tiklenen alanlar var.`,
      });
    }
    return out;
  }, [state, purpose]);

  function toggle(field: ViewField): void {
    setAsked((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  }

  return (
    <div className="desk">
      <section className="sheet">
        <h2>AI</h2>
        <div className="thread">
          {messages.map((message, index) => (
            <div key={index} className={`msg ${message.kind}`}>
              <small>{message.who}</small>
              {message.text}
            </div>
          ))}
        </div>
        <label className="block" htmlFor="purpose">İstek gerekçesi</label>
        <textarea
          id="purpose"
          rows={3}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        />
        <label className="block">İstenecek alanlar</label>
        <div className="chips">
          {VIEW_FIELDS.map((field) => (
            <label key={field}>
              <input
                type="checkbox"
                checked={asked.includes(field)}
                onChange={() => toggle(field)}
              />
              {FIELD_LABELS[field]}
            </label>
          ))}
        </div>
        <div className="row">
          <button
            type="button"
            disabled={waiting || asked.length === 0}
            onClick={() => {
              setError(null);
              requestView(purpose, asked).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "İstek gönderilemedi.");
              });
            }}
          >
            Windows yetkisi iste
          </button>
          <button
            type="button"
            className="warn"
            disabled={!state.grant}
            onClick={() => {
              setError(null);
              revokeView().catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Kapatılamadı.");
              });
            }}
          >
            Görünümü kapat
          </button>
        </div>
        {waiting ? (
          <p className="lede">
            Onay bekleniyor. Kullanıcı makinesindeki pencere: <a href="#/onay">Windows onayı</a>
          </p>
        ) : null}
        {error ? <p className="lede">{error}</p> : null}
      </section>

      <section className="sheet">
        <h2>İzinli fiş</h2>
        {hasView && state.view && state.grant ? (
          <LedgerTable view={state.view} grant={state.grant} />
        ) : (
          <p className="empty">
            Henüz görünüm yok. AI izin ister, Windows onaylar, ajan satırları buraya iter.
          </p>
        )}
      </section>
    </div>
  );
}
