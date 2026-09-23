import { NFT_THRESHOLD, TEXT } from "../../eta-core/src/rules/purchase-invoice.ts";
import { SYSTEM_PROMPT } from "./ai.ts";

export interface KnowledgePack {
  version: string;
  vatDescription: string;
  cashAccount: string;
  nftPurchase: string;
  purchaseHeaderNote: string;
  vatAccount: string;
  expenseAccount: string;
  nftThresholdKurus: number;
  prompt: string;
  modelHint: string;
}

export function buildKnowledgePack(): KnowledgePack {
  return {
    version: "2026.09.23",
    vatDescription: TEXT.vatDefault,
    cashAccount: TEXT.cashAccount,
    nftPurchase: TEXT.nftPurchase,
    purchaseHeaderNote: TEXT.purchaseHeaderNote,
    vatAccount: "191 02 20",
    expenseAccount: "770 01",
    nftThresholdKurus: NFT_THRESHOLD,
    prompt: SYSTEM_PROMPT,
    modelHint: "grok-4.20-0309-reasoning",
  };
}
