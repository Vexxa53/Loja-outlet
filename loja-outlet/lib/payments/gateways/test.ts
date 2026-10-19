import { randomBytes } from "node:crypto";
import { CARD_BRANDS } from "../types";

/**
 * Gateway de SIMULAÇÃO. Não existe cobrança real aqui: serve para testar o fluxo inteiro
 * (PIX, cartão, aprovado, recusado, pendente, expirado, cancelado, estornado).
 * O token do cartão de teste é gerado no navegador e NUNCA contém número de cartão.
 */
export type TestScenario = "approved" | "declined" | "pending";

const TOKEN_RE = /^tok_test_(approved|declined|pending)_[a-z0-9]{8,32}$/;

export function parseTestToken(token: string): TestScenario | null {
  const m = TOKEN_RE.exec(token);
  return m ? (m[1] as TestScenario) : null;
}

export const validBrand = (b: string) => (CARD_BRANDS as readonly string[]).includes(b);

export function fakePix(txId: string): { copyPaste: string; qr: string } {
  return { copyPaste: `TESTE-SIMULADO-NAO-PAGAVEL-${txId}`, qr: `TESTE:${txId}` };
}

export const newTransactionId = (orderNumber: number) => `TX${orderNumber}-${randomBytes(5).toString("hex").toUpperCase()}`;
