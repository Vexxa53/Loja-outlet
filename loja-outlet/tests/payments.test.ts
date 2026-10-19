import { describe, expect, it } from "vitest";
import { canPaymentTransition, installmentOptions, orderLabel } from "../lib/payments/types";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { parseTestToken } from "../lib/payments/gateways/test";
import { luhn, tokenizeTestCard } from "../lib/payments/test-card";

describe("regras puras de pagamento", () => {
  it("formata o número do pedido", () => { expect(orderLabel(1)).toBe("#001"); expect(orderLabel(1234)).toBe("#1234"); });

  it("máquina de estados do pagamento", () => {
    expect(canPaymentTransition("PENDING", "APPROVED")).toBe(true);
    expect(canPaymentTransition("PENDING", "PROCESSING")).toBe(true);
    expect(canPaymentTransition("APPROVED", "REFUNDED")).toBe(true);
    expect(canPaymentTransition("APPROVED", "REJECTED")).toBe(false);
    expect(canPaymentTransition("REJECTED", "APPROVED")).toBe(false);
    expect(canPaymentTransition("EXPIRED", "APPROVED")).toBe(false);
    expect(canPaymentTransition("PENDING", "REFUNDED")).toBe(false);
  });

  it("parcelas sem juros respeitam parcela mínima e o máximo", () => {
    const o = installmentOptions(30000, { max: 6, minCents: 5000 });
    expect(o.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(installmentOptions(9000, { max: 6, minCents: 5000 }).map((x) => x.n)).toEqual([1]);
    expect(installmentOptions(10001, { max: 2, minCents: 1000 })[1].perCents).toBe(5001); // arredonda para cima
    expect(installmentOptions(100, { max: 0, minCents: 0 }).length).toBe(1);
  });
});

describe("segredos criptografados", () => {
  it("cifra e decifra; valor guardado não contém o texto original", () => {
    process.env.AUTH_SECRET = "teste-secreto-1234567890";
    const blob = encryptSecret("APP_USR-segredo-de-teste");
    expect(blob).not.toContain("segredo");
    expect(decryptSecret(blob)).toBe("APP_USR-segredo-de-teste");
  });
  it("detecta adulteração e chave trocada", () => {
    process.env.AUTH_SECRET = "chave-a-1234567890";
    const blob = encryptSecret("x");
    expect(decryptSecret(blob.slice(0, -2) + "AA")).toBeNull();
    process.env.AUTH_SECRET = "chave-b-1234567890";
    expect(decryptSecret(blob)).toBeNull();
  });
});

describe("cartão de teste (tokenização)", () => {
  it("só aceita cartões de teste e devolve token sem número", () => {
    const t = tokenizeTestCard("4242 4242 4242 4242");
    expect("error" in t).toBe(false);
    if (!("error" in t)) {
      expect(t.last4).toBe("4242"); expect(t.brand).toBe("visa");
      expect(t.token).not.toContain("4242424242424242");
      expect(parseTestToken(t.token)).toBe("approved");
    }
    expect("error" in tokenizeTestCard("4000 0000 0000 0002")).toBe(false);
    expect("error" in tokenizeTestCard("1234 5678 9012 3456")).toBe(true); // Luhn inválido
    expect("error" in tokenizeTestCard("5555 5555 5555 4444")).toBe(true); // válido, mas não é cartão de teste
    expect(luhn("4242424242424242")).toBe(true);
  });
  it("rejeita tokens forjados", () => {
    expect(parseTestToken("tok_live_approved_abcdefgh")).toBeNull();
    expect(parseTestToken("4242424242424242")).toBeNull();
    expect(parseTestToken("tok_test_approved_ab")).toBeNull();
  });
});
