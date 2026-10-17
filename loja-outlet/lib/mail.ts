/** Envio via Resend (REST). Sem RESEND_API_KEY o e-mail não é enviado (apenas aviso no log, sem expor o link). */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.warn("[mail] RESEND_API_KEY/MAIL_FROM não configurados: e-mail não enviado.");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  return res.ok;
}
