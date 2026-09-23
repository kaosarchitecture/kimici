import { formatTr } from "./money.ts";
import { totals, type VoucherPlan } from "./types.ts";

/** Turkish operator preview of a planned voucher. No customer identifiers beyond what the plan already holds. */
export function formatPlanPreview(plan: VoucherPlan): string {
  const { debit, credit } = totals(plan.lines);
  const lines = [
    `Şirket DB: ${plan.companyDb}`,
    `Fiş tipi: ${plan.kind} (${plan.mode})`,
    `Fiş tarihi: ${plan.headerDate}`,
    ...(plan.specialCode1 ? [`Özel kod: ${plan.specialCode1}`] : []),
    ...(plan.headerNote ? [`Başlık notu: ${plan.headerNote}`] : []),
    `Satır: ${plan.lines.length}`,
    `Borç: ${formatTr(debit)}  Alacak: ${formatTr(credit)}  Fark: ${formatTr(debit - credit)}`,
    "",
    "Sıra  Hesap            B/A      Tutar  Kural                 Açıklama",
  ];
  for (const line of plan.lines) {
    const side = line.side === "D" ? "B" : "A";
    lines.push(
      `${String(line.seq).padStart(4)}  ${line.account.padEnd(15)} ${side}  ${formatTr(line.amount).padStart(12)}  ${line.ruleId.padEnd(22)} ${line.description}`,
    );
  }
  if (plan.blockers.length > 0) {
    lines.push("", "Durdurucu:");
    for (const blocker of plan.blockers) lines.push(`- [${blocker.code}] ${blocker.message}`);
  }
  return lines.join("\n");
}
