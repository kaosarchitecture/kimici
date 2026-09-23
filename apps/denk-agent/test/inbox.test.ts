import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildKnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { runInbox } from "../src/inbox.ts";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function folder(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "denk-inbox-"));
  dirs.push(dir);
  return dir;
}

describe("local log and audit", () => {
  it("builds vouchers on this machine and does not echo the source file", async () => {
    const dir = await folder();
    const xml = `<?xml version="1.0"?><Invoice><cbc:ID>XML-1</cbc:ID><cbc:IssueDate>2026-01-02</cbc:IssueDate><cbc:Name>Ornek</cbc:Name><cbc:TaxExclusiveAmount>100.00</cbc:TaxExclusiveAmount><cbc:TaxAmount>20.00</cbc:TaxAmount><cbc:PayableAmount>120.00</cbc:PayableAmount></Invoice>`;
    await writeFile(join(dir, "fatura.xml"), xml);
    await writeFile(
      join(dir, "alis.audit.json"),
      JSON.stringify({
        invoiceNo: "AUD-9",
        tarih: "15.03.2026",
        unvan: "Ornek Ltd",
        matrah: "50.000,00",
        kdv: "10.000,00",
        odenecek: "60.000,00",
      }),
    );
    await writeFile(
      join(dir, "islem.log"),
      ["EVRAK LOG-1", "TARIH 2026-02-01", "UNVAN Deneme", "MATRAH 50,00", "KDV 10,00", "ODENECEK 60,00"].join("\n"),
    );

    const result = await runInbox(dir, buildKnowledgePack());
    const body = JSON.stringify(result);
    expect(result.status).toBe("done");
    expect(result.vouchers.map((row) => row.invoiceNo).sort()).toEqual(["AUD-9", "LOG-1", "XML-1"]);
    expect(result.vouchers.find((row) => row.invoiceNo === "XML-1")?.lines.some((line) => line.description === "İND.KDV.")).toBe(true);
    expect(result.vouchers.find((row) => row.invoiceNo === "XML-1")?.lines.some((line) => line.account === "100 01")).toBe(true);
    expect(result.vouchers.find((row) => row.invoiceNo === "AUD-9")?.lines.some((line) => line.description === "N.FT İLE ALIŞ")).toBe(true);
    expect(body).not.toContain("<Invoice");
    expect(body).not.toContain("TaxExclusiveAmount");
  });

  it("reports an empty computer folder without inventing a voucher", async () => {
    const dir = await folder();
    const result = await runInbox(dir, buildKnowledgePack());
    expect(result.status).toBe("empty");
    expect(result.vouchers).toEqual([]);
  });
});
