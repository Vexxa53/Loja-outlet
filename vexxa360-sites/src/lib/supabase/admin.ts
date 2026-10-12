import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serviceRoleKey } from "../env";

/**
 * Cliente com service_role: IGNORA o RLS. Uso restrito ao servidor e a 2 casos:
 *  1) place_order (pedido da vitrine, validado no banco);
 *  2) painel master (após verificar is_platform_admin).
 * Nunca importe em componentes de cliente (o pacote "server-only" quebra o build se isso ocorrer).
 */
export function createAdminClient() {
  return createClient(publicEnv().url, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
