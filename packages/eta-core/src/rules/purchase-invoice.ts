import { rootAccount } from "../accounts.ts";
import { percentOf, type Kurus } from "../money.ts";
import type { Blocker, IsoDate, PlanLine, VoucherPlan } from "../types.ts";

/** Kural 13: purchase invoices at or above this payable amount must close to a supplier account. */
export const NFT_THRESHOLD: Kurus = 3_000_000;

export const TEXT = {
  nftPurchase: "N.FT İLE ALIŞ",
  vatDefault: "İND.KDV.",
  kkegMemo: "K.K.E.GİDERLER",
  vatSpecialCode: "INDKDV",
  purchaseSpecialCode1: "ALF",
  purchaseHeaderNote: "ALIM FATURASI",
  /** Unmapped / cash closing. Canonical spelling is `100 01` (space, two-digit subcode). */
  cashAccount: "100 01",
} as const;

export type PurchaseCategory = "passenger-car-service" | "general-expense" | "trade-goods";

export interface PassengerCarAccounts {
  expenseAccount: string;
  kkegAccount: string;
  memoDebitAccount: string;
  memoCreditAccount: string;
  /** Deductible share in percent (GVK 40/5 binek oto: 70). */
  acceptedPercent: number;
}

export const DEFAULT_PASSENGER_CAR: PassengerCarAccounts = {
  expenseAccount: "770 13",
  kkegAccount: "689 01",
  memoDebitAccount: "950 01",
  memoCreditAccount: "951 01",
  acceptedPercent: 70,
};

export interface PurchaseInvoiceInput {
  companyDb: string;
  invoiceNo: string;
  issueDate: IsoDate;
  supplierName: string;
  netAmount: Kurus;
  vatAmount: Kurus;
  payableAmount: Kurus;
  category: PurchaseCategory;
  vatAccount: string;
  /** Existing supplier account in this company's MUHHESAP (e.g. "320 A=014"), or null if none. */
  supplierAccount: string | null;
  /** Required for general-expense and trade-goods (learned from the company's history). */
  expenseAccount?: string;
  cashAccount?: string;
  /** VAT line text. Canonical office spelling is `İND.KDV.` */
  vatDescription?: string;
  passengerCar?: PassengerCarAccounts;
  item?: string;
  unit?: string;
  quantity?: number;
}

export function planPurchaseInvoice(input: PurchaseInvoiceInput): VoucherPlan {
  const blockers: Blocker[] = [];
  const supplierName = input.supplierName.trim();
  if (supplierName.length === 0) {
    blockers.push({
      code: "SUPPLIER_NAME_MISSING",
      message: "Tedarikçi unvanı veya adı yok. Açıklamaya 'ALIM' yazılamaz, işlem durduruldu.",
    });
  }

  const closing = resolveClosing(input, supplierName, blockers);
  const base = {
    docNo: input.invoiceNo.trim(),
    lineDate: input.issueDate,
    docDate: input.issueDate,
  };
  const expenseDetail = {
    ...(closing.account && closing.isSupplier ? { reference: `(${closing.account})` } : {}),
    ...(input.item ? { item: input.item } : {}),
    ...(input.unit ? { unit: input.unit } : {}),
    quantity: input.quantity ?? 1,
  };
  const vatDescription = input.vatDescription ?? TEXT.vatDefault;
  const lines: Omit<PlanLine, "seq">[] = [];

  if (input.category === "passenger-car-service") {
    const car = input.passengerCar ?? DEFAULT_PASSENGER_CAR;
    const acceptedExpense = percentOf(input.netAmount, car.acceptedPercent);
    const acceptedVat = percentOf(input.vatAmount, car.acceptedPercent);
    const kkeg = input.payableAmount - acceptedExpense - acceptedVat;
    const kkegByRatio = percentOf(input.payableAmount, 100 - car.acceptedPercent);
    if (Math.abs(kkeg - kkegByRatio) > 1) {
      blockers.push({
        code: "KKEG_MISMATCH",
        message: `KKEG kalanı (${kkeg}) oran hesabından (${kkegByRatio}) 1 kuruştan fazla sapıyor. Faturada başka vergi veya tevkifat olabilir.`,
      });
    }
    lines.push(
      { ...base, account: car.expenseAccount, side: "D", amount: acceptedExpense, description: supplierName, specialCode: TEXT.vatSpecialCode, detail: expenseDetail, ruleId: "R16.passenger-car.accepted-expense" },
      { ...base, account: car.kkegAccount, side: "D", amount: kkeg, description: supplierName, specialCode: TEXT.vatSpecialCode, ruleId: "R16.passenger-car.kkeg" },
      { ...base, account: input.vatAccount, side: "D", amount: acceptedVat, description: vatDescription, specialCode: TEXT.vatSpecialCode, ruleId: "R16.passenger-car.accepted-vat" },
      { ...base, account: closing.account, side: "C", amount: input.payableAmount, description: closing.description, ruleId: closing.ruleId },
      { ...base, account: car.memoDebitAccount, side: "D", amount: kkeg, description: TEXT.kkegMemo, ruleId: "R16.passenger-car.memo" },
      { ...base, account: car.memoCreditAccount, side: "C", amount: kkeg, description: TEXT.kkegMemo, ruleId: "R16.passenger-car.memo" },
    );
  } else {
    if (!input.expenseAccount) {
      blockers.push({
        code: "EXPENSE_ACCOUNT_MISSING",
        message: "Gider/mal hesabı belirlenmedi. Şirketin önceki faturalarından öneri alınmalı.",
      });
    }
    if (input.netAmount + input.vatAmount !== input.payableAmount) {
      blockers.push({
        code: "PAYABLE_MISMATCH",
        message: "Matrah + KDV ödenecek tutara eşit değil. Tevkifat veya ek vergi kalıbı henüz desteklenmiyor.",
      });
    }
    const ruleId = input.category === "trade-goods" ? "R19.trade-goods" : "R19.general-expense";
    lines.push(
      { ...base, account: input.expenseAccount ?? "", side: "D", amount: input.netAmount, description: supplierName, specialCode: TEXT.vatSpecialCode, detail: expenseDetail, ruleId },
      { ...base, account: input.vatAccount, side: "D", amount: input.vatAmount, description: vatDescription, specialCode: TEXT.vatSpecialCode, ruleId: `${ruleId}.vat` },
      { ...base, account: closing.account, side: "C", amount: input.payableAmount, description: closing.description, ruleId: closing.ruleId },
    );
  }

  return {
    companyDb: input.companyDb,
    kind: "FAT",
    mode: "single-invoice",
    headerDate: input.issueDate,
    specialCode1: TEXT.purchaseSpecialCode1,
    headerNote: TEXT.purchaseHeaderNote,
    lines: lines.map((line, index) => ({ ...line, seq: index + 1 })),
    blockers,
  };
}

interface Closing {
  account: string;
  description: string;
  isSupplier: boolean;
  ruleId: string;
}

/** Kural 13 decision table. */
function resolveClosing(input: PurchaseInvoiceInput, supplierName: string, blockers: Blocker[]): Closing {
  const cash = input.cashAccount ?? TEXT.cashAccount;
  if (input.supplierAccount && rootAccount(input.supplierAccount) !== "320") {
    blockers.push({
      code: "SUPPLIER_ACCOUNT_NOT_320",
      message: `Tedarikçi hesabı 320 grubunda değil: ${input.supplierAccount}`,
    });
  }
  if (input.payableAmount >= NFT_THRESHOLD) {
    if (!input.supplierAccount) {
      blockers.push({
        code: "NEW_SUPPLIER_ACCOUNT_REQUIRED",
        message: "30.000 TL ve üzeri fatura için cari kart yok. Kasaya kapatılamaz; önce 320 cari kartı açılmalı (onay gerekir).",
      });
      return { account: "", description: TEXT.nftPurchase, isSupplier: true, ruleId: "R13.nft.new-supplier" };
    }
    return { account: input.supplierAccount, description: TEXT.nftPurchase, isSupplier: true, ruleId: "R13.nft.supplier" };
  }
  if (input.supplierAccount) {
    return { account: input.supplierAccount, description: supplierName, isSupplier: true, ruleId: "R13.below.supplier" };
  }
  return { account: cash, description: supplierName, isSupplier: false, ruleId: "R13.below.cash" };
}
