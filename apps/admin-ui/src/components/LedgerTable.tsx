import { FIELD_LABELS, formatClock } from "../labels.ts";
import type { ConsentGrant, ViewPayload } from "../types.ts";

export function LedgerTable(props: { view: ViewPayload; grant: ConsentGrant }) {
  const fields = props.view.fieldSet;
  return (
    <div>
      <p className="lede">
        {props.grant.identity.account} onayladı · {props.view.records.length} satır ·{" "}
        {formatClock(props.view.pushedAt)}. Sunucu makineye gitmedi.
      </p>
      <table className="ledger">
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field}>{FIELD_LABELS[field]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.view.records.map((row, index) => (
            <tr key={index} className={row.description === "İND.KDV." ? "vat" : undefined}>
              {fields.map((field) => (
                <td key={field} className={field === "amountText" ? "num" : undefined}>
                  {row[field] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
