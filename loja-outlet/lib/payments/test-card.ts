/**
 * Tokenização SIMULADA (só modo de teste). Roda no navegador; o número digitado nunca é enviado ao servidor:
 * sai daqui apenas { token, brand, last4 }. Em produção, o gateway real faz isto com a Public Key (SDK do gateway).
 */
export const TEST_CARDS = [
  { number: "4242 4242 4242 4242", label: "Aprovado", scenario: "approved" },
  { number: "4000 0000 0000 0002", label: "Recusado", scenario: "declined" },
  { number: "4000 0000 0000 0341", label: "Em análise (pendente)", scenario: "pending" },
] as const;

export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

export function detectBrand(d: string): string {
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|6516|6550)/.test(d)) return "elo";
  if (/^(606282|3841)/.test(d)) return "hipercard";
  return "outra";
}

export function tokenizeTestCard(rawNumber: string): { token: string; brand: string; last4: string } | { error: string } {
  const d = rawNumber.replace(/\D/g, "");
  if (!luhn(d)) return { error: "Número de cartão inválido." };
  const known = TEST_CARDS.find((c) => c.number.replace(/\s/g, "") === d);
  if (!known) return { error: "No modo de teste use um dos cartões de teste listados." };
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join("");
  return { token: `tok_test_${known.scenario}_${rnd}`, brand: detectBrand(d), last4: d.slice(-4) };
}
