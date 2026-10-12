"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";
import { authorize } from "../auth/context";
import { ORDER_STATUSES } from "../statuses";
import { NOT_LOGGED, WRITE, dbMessage, flash } from "./helpers";

export async function changeOrderStatus(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const back = `/admin/pedidos/${id}`;
  const ctx = await authorize(WRITE);
  if (!ctx) flash(back, "erro", NOT_LOGGED);
  const status = String(fd.get("status") ?? "");
  if (!ORDER_STATUSES.some((s) => s.value === status)) flash(back, "erro", "Status inválido.");
  const supabase = await createClient();
  // O banco confere se o pedido é de uma loja do usuário e aplica a regra de estoque (devolução ao cancelar).
  const { error } = await supabase.rpc("change_order_status", { p_order: id, p_new_status: status });
  if (error) flash(back, "erro", dbMessage(error));
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  flash(back, "ok", status === "cancelled" ? "Pedido cancelado e estoque devolvido." : "Status atualizado.");
}

export async function saveOrderNotes(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const back = `/admin/pedidos/${id}`;
  const ctx = await authorize(WRITE);
  if (!ctx) flash(back, "erro", NOT_LOGGED);
  const supabase = await createClient();
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 500) || null;
  const { error } = await supabase.from("orders").update({ notes }).eq("id", id).eq("tenant_id", ctx!.tenantId);
  if (error) flash(back, "erro", dbMessage(error));
  flash(back, "ok", "Observações salvas.");
}

export async function releaseExpired() {
  const ctx = await authorize(WRITE);
  if (!ctx) flash("/admin/pedidos", "erro", NOT_LOGGED);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("release_expired_reservations", { p_tenant: ctx!.tenantId });
  if (error) flash("/admin/pedidos", "erro", dbMessage(error));
  revalidatePath("/admin/pedidos");
  flash("/admin/pedidos", "ok", data ? `${data} reserva(s) expirada(s) cancelada(s) e estoque devolvido.` : "Nenhuma reserva expirada.");
}
