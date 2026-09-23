import { describe, expect, it } from "vitest";
import { parseUblInvoice } from "../src/ubl.ts";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV2026000002000</cbc:ID>
  <cbc:IssueDate>2026-08-26</cbc:IssueDate>
  <cac:AccountingSupplierParty>
    <cac:Party><cac:PartyName><cbc:Name>ÖRNEK MOTOR SERVİS A.Ş. - ÖRNEK ŞUBE</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount>10141.83</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount>50709.11</cbc:TaxExclusiveAmount>
    <cbc:PayableAmount>60850.94</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

describe("parseUblInvoice", () => {
  it("reads UBL-TR invoice fields with Turkish amounts", () => {
    const doc = parseUblInvoice(SAMPLE, "fatura.xml", "application/xml", SAMPLE.length);
    expect(doc.kind).toBe("ubl-invoice");
    expect(doc.invoiceNo).toBe("INV2026000002000");
    expect(doc.issueDate).toBe("2026-08-26");
    expect(doc.supplierName).toContain("ÖRNEK MOTOR");
    expect(doc.netText).toBe("50.709,11");
    expect(doc.vatText).toBe("10.141,83");
    expect(doc.payableText).toBe("60.850,94");
  });
});
