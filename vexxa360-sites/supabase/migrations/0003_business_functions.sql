-- Vexxa360° Sites — 0003: regras de negócio críticas dentro do banco (atômicas)
--
-- POLÍTICA DE ESTOQUE
--   * RESERVA: ao criar o pedido (place_order) as unidades são baixadas na hora
--     (movimento 'reservation'). Isso impede duas vendas da última unidade.
--   * Pedido criado pelo WhatsApp NÃO é pago nem confirmado: nasce como 'new'.
--   * DEVOLUÇÃO: ao cancelar (change_order_status → cancelled) o estoque volta
--     (movimento 'return'). Pedidos cancelados/concluídos não mudam mais de status.
--   * EXPIRAÇÃO: pedidos que continuam 'new' além de store_settings.reservation_hours
--     são cancelados por release_expired_reservations(), devolvendo o estoque.
--   * FATURAMENTO só conta pedidos confirmed/preparing/shipped/completed.

-- ------------------------------------------------------------------ place_order
-- Só o service role (servidor Next.js) pode chamar. Preços e estoque são lidos
-- do banco; o navegador envia apenas variant_id e quantidade.
create or replace function public.place_order(
  p_tenant_slug    text,
  p_customer_name  text,
  p_customer_phone text,
  p_customer_email text,
  p_notes          text,
  p_items          jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant      public.tenants%rowtype;
  v_settings    public.store_settings%rowtype;
  v_number      integer;
  v_order_id    uuid := gen_random_uuid();
  v_subtotal    numeric(12,2) := 0;
  v_total       numeric(12,2) := 0;
  v_item        record;
  v_var         record;
  v_regular     numeric(12,2);
  v_unit        numeric(12,2);
  v_phone       text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_lines       jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'TOO_MANY_ITEMS'; end if;
  if char_length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'INVALID_NAME'; end if;
  if v_phone !~ '^[0-9]{10,15}$' then raise exception 'INVALID_PHONE'; end if;

  select * into v_tenant from public.tenants where slug = p_tenant_slug and status = 'active';
  if not found then raise exception 'STORE_NOT_FOUND'; end if;
  select * into v_settings from public.store_settings where tenant_id = v_tenant.id;
  if not found or not v_settings.published then raise exception 'STORE_NOT_FOUND'; end if;

  -- Agrega duplicatas e trava as variações em ordem fixa (evita deadlock).
  for v_item in
    select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'quantity')::int) as quantity
    from jsonb_array_elements(p_items) e
    group by 1 order by 1
  loop
    if v_item.quantity < 1 or v_item.quantity > 50 then raise exception 'INVALID_QUANTITY'; end if;

    select v.id, v.sku, v.size, v.color, v.active, v.stock_quantity,
           p.id as product_id, p.name as product_name, p.status, p.archived_at
      into v_var
      from public.product_variants v
      join public.products p on p.id = v.product_id and p.tenant_id = v.tenant_id
     where v.id = v_item.variant_id and v.tenant_id = v_tenant.id
     for update of v;

    if not found or not v_var.active or v_var.status <> 'published' or v_var.archived_at is not null then
      raise exception 'ITEM_UNAVAILABLE:%', v_item.variant_id;
    end if;

    -- Baixa condicional atômica: nunca fica negativo, mesmo com compras simultâneas.
    update public.product_variants
       set stock_quantity = stock_quantity - v_item.quantity
     where id = v_item.variant_id and stock_quantity >= v_item.quantity;
    if not found then
      raise exception 'INSUFFICIENT_STOCK:%', v_item.variant_id;
    end if;

    select regular_price into v_regular from public.products where id = v_var.product_id;
    v_unit := public.effective_price(v_var.product_id, now());
    v_subtotal := v_subtotal + v_regular * v_item.quantity;
    v_total := v_total + v_unit * v_item.quantity;

    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_var.id, 'product_id', v_var.product_id, 'name', v_var.product_name,
      'sku', v_var.sku, 'size', v_var.size, 'color', v_var.color,
      'quantity', v_item.quantity, 'regular_unit_price', v_regular, 'unit_price', v_unit);
  end loop;

  insert into public.order_counters (tenant_id, last_number) values (v_tenant.id, 1)
  on conflict (tenant_id) do update set last_number = public.order_counters.last_number + 1
  returning last_number into v_number;

  insert into public.orders (id, tenant_id, order_number, customer_name, customer_phone,
                             customer_email, status, subtotal, discount_amount, total, source, notes)
  values (v_order_id, v_tenant.id, v_number, trim(p_customer_name), v_phone,
          nullif(trim(coalesce(p_customer_email, '')), ''), 'new', v_subtotal,
          v_subtotal - v_total, v_total, 'whatsapp', nullif(trim(coalesce(p_notes, '')), ''));

  insert into public.order_items (tenant_id, order_id, product_id, variant_id, product_name_snapshot,
                                  sku_snapshot, size_snapshot, color_snapshot, quantity,
                                  regular_unit_price, unit_price, line_total)
  select v_tenant.id, v_order_id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid,
         l ->> 'name', l ->> 'sku', l ->> 'size', l ->> 'color', (l ->> 'quantity')::int,
         (l ->> 'regular_unit_price')::numeric, (l ->> 'unit_price')::numeric,
         (l ->> 'unit_price')::numeric * (l ->> 'quantity')::int
  from jsonb_array_elements(v_lines) l;

  insert into public.inventory_movements (tenant_id, variant_id, movement_type, quantity, reason, order_id)
  select v_tenant.id, (l ->> 'variant_id')::uuid, 'reservation', -(l ->> 'quantity')::int,
         'Reserva do pedido #' || v_number, v_order_id
  from jsonb_array_elements(v_lines) l;

  insert into public.order_status_history (tenant_id, order_id, previous_status, new_status, changed_by)
  values (v_tenant.id, v_order_id, null, 'new', null);

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_number, 'subtotal', v_subtotal,
    'discount_amount', v_subtotal - v_total, 'total', v_total,
    'whatsapp', v_settings.whatsapp, 'store_name', v_settings.store_name,
    'items', v_lines);
end $$;

revoke all on function public.place_order(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to service_role;

-- ----------------------------------------------------------- cancelamento interno
create or replace function public._cancel_order(p_order uuid, p_by uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  i record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('cancelled', 'completed') then raise exception 'ORDER_TERMINAL'; end if;

  for i in select variant_id, quantity from public.order_items
            where order_id = o.id and variant_id is not null order by variant_id loop
    update public.product_variants set stock_quantity = stock_quantity + i.quantity where id = i.variant_id;
    insert into public.inventory_movements (tenant_id, variant_id, movement_type, quantity, reason, order_id, created_by)
    values (o.tenant_id, i.variant_id, 'return', i.quantity, p_reason, o.id, p_by);
  end loop;

  update public.orders set status = 'cancelled' where id = o.id;
  insert into public.order_status_history (tenant_id, order_id, previous_status, new_status, changed_by)
  values (o.tenant_id, o.id, o.status, 'cancelled', p_by);
end $$;
revoke all on function public._cancel_order(uuid, uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------- change_order_status
create or replace function public.change_order_status(p_order uuid, p_new_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_new_status not in ('new','awaiting_confirmation','confirmed','preparing','shipped','completed','cancelled') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into o from public.orders where id = p_order for update;
  -- mesma resposta para "não existe" e "é de outra loja": não vaza existência
  if not found or not public.has_tenant_role(o.tenant_id, array['owner','admin','staff']) then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if o.status in ('cancelled', 'completed') then raise exception 'ORDER_TERMINAL'; end if;
  if o.status = p_new_status then return; end if;

  if p_new_status = 'cancelled' then
    perform public._cancel_order(o.id, auth.uid(), 'Cancelamento do pedido #' || o.order_number);
    return;
  end if;

  update public.orders set status = p_new_status where id = o.id;
  insert into public.order_status_history (tenant_id, order_id, previous_status, new_status, changed_by)
  values (o.tenant_id, o.id, o.status, p_new_status, auth.uid());
end $$;
revoke all on function public.change_order_status(uuid, text) from public, anon;
grant execute on function public.change_order_status(uuid, text) to authenticated;

-- ------------------------------------------------- release_expired_reservations
create or replace function public.release_expired_reservations(p_tenant uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_hours integer;
  v_count integer := 0;
  r record;
begin
  if not public.has_tenant_role(p_tenant, array['owner','admin','staff']) then
    raise exception 'FORBIDDEN';
  end if;
  select reservation_hours into v_hours from public.store_settings where tenant_id = p_tenant;
  for r in select id from public.orders
            where tenant_id = p_tenant and status = 'new'
              and created_at < now() - make_interval(hours => coalesce(v_hours, 48)) loop
    perform public._cancel_order(r.id, auth.uid(), 'Reserva expirada (sem confirmação)');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.release_expired_reservations(uuid) from public, anon;
grant execute on function public.release_expired_reservations(uuid) to authenticated;

-- ---------------------------------------------------------------- adjust_stock
-- Ajuste manual com delta (entrada positiva / saída negativa).
create or replace function public.adjust_stock(p_variant uuid, p_delta integer, p_type text, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v public.product_variants%rowtype;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_type not in ('entry', 'adjustment', 'loss') then raise exception 'INVALID_TYPE'; end if;
  if p_delta = 0 then raise exception 'INVALID_QUANTITY'; end if;
  if (p_type = 'entry' and p_delta < 0) or (p_type = 'loss' and p_delta > 0) then
    raise exception 'INVALID_QUANTITY';
  end if;

  select * into v from public.product_variants where id = p_variant for update;
  if not found or not public.has_tenant_role(v.tenant_id, array['owner','admin','staff']) then
    raise exception 'VARIANT_NOT_FOUND';
  end if;
  if v.stock_quantity + p_delta < 0 then raise exception 'NEGATIVE_STOCK'; end if;

  update public.product_variants set stock_quantity = stock_quantity + p_delta where id = v.id;
  insert into public.inventory_movements (tenant_id, variant_id, movement_type, quantity, reason, created_by)
  values (v.tenant_id, v.id, p_type, p_delta, left(p_reason, 300), auth.uid());
  return v.stock_quantity + p_delta;
end $$;
revoke all on function public.adjust_stock(uuid, integer, text, text) from public, anon;
grant execute on function public.adjust_stock(uuid, integer, text, text) to authenticated;

-- Define a quantidade absoluta (contagem de estoque), calculando o delta com a linha travada.
create or replace function public.set_stock(p_variant uuid, p_quantity integer, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v public.product_variants%rowtype;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_quantity < 0 then raise exception 'NEGATIVE_STOCK'; end if;
  select * into v from public.product_variants where id = p_variant for update;
  if not found or not public.has_tenant_role(v.tenant_id, array['owner','admin','staff']) then
    raise exception 'VARIANT_NOT_FOUND';
  end if;
  if p_quantity = v.stock_quantity then return p_quantity; end if;
  update public.product_variants set stock_quantity = p_quantity where id = v.id;
  insert into public.inventory_movements (tenant_id, variant_id, movement_type, quantity, reason, created_by)
  values (v.tenant_id, v.id, 'adjustment', p_quantity - v.stock_quantity,
          coalesce(nullif(left(p_reason, 300), ''), 'Contagem de estoque'), auth.uid());
  return p_quantity;
end $$;
revoke all on function public.set_stock(uuid, integer, text) from public, anon;
grant execute on function public.set_stock(uuid, integer, text) to authenticated;

-- --------------------------------------------------------------- dashboard_stats
-- SECURITY INVOKER: o RLS do usuário que chama continua valendo.
create or replace function public.dashboard_stats(p_tenant uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_threshold integer;
  v_result jsonb;
begin
  -- Painel é só para a equipe da loja (a vitrine pública também é legível pelo RLS,
  -- por isso a checagem explícita: quem não é da loja não recebe nem contagens).
  if not public.has_tenant_role(p_tenant, array['owner','admin','staff']) then
    raise exception 'FORBIDDEN';
  end if;
  select low_stock_threshold into v_threshold from public.store_settings where tenant_id = p_tenant;
  v_threshold := coalesce(v_threshold, 3);

  with stock as (
    select p.id, coalesce(sum(v.stock_quantity) filter (where v.active), 0) as qty
    from public.products p
    left join public.product_variants v on v.product_id = p.id
    where p.tenant_id = p_tenant and p.archived_at is null
    group by p.id
  ),
  ord as (
    select * from public.orders where tenant_id = p_tenant and created_at >= p_from and created_at < p_to
  ),
  top as (
    select oi.product_name_snapshot as name, sum(oi.quantity)::int as quantity, sum(oi.line_total) as revenue
    from public.order_items oi join ord on ord.id = oi.order_id
    where ord.status in ('confirmed','preparing','shipped','completed')
    group by oi.product_name_snapshot order by sum(oi.quantity) desc limit 5
  )
  select jsonb_build_object(
    'total_products',     (select count(*) from public.products where tenant_id = p_tenant and archived_at is null),
    'published_products', (select count(*) from public.products where tenant_id = p_tenant and archived_at is null and status = 'published'),
    'promo_products',     (select count(*) from public.catalog_products c where c.tenant_id = p_tenant and c.on_sale),
    'low_stock_products', (select count(*) from stock where qty > 0 and qty <= v_threshold),
    'out_of_stock_products', (select count(*) from stock where qty = 0),
    'orders_new',         (select count(*) from ord where status = 'new'),
    'orders_in_progress', (select count(*) from ord where status in ('awaiting_confirmation','confirmed','preparing','shipped')),
    'orders_completed',   (select count(*) from ord where status = 'completed'),
    'orders_cancelled',   (select count(*) from ord where status = 'cancelled'),
    'revenue',            coalesce((select sum(total) from ord where status in ('confirmed','preparing','shipped','completed')), 0),
    'top_products',       coalesce((select jsonb_agg(to_jsonb(top)) from top), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.dashboard_stats(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_stats(uuid, timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------- hostname → loja (domínio próprio)
-- Preparação para domínios por cliente: só devolve domínios ATIVOS.
create or replace function public.resolve_tenant_slug(p_hostname text)
returns text language sql stable security definer set search_path = public as $$
  select t.slug from public.tenant_domains d join public.tenants t on t.id = d.tenant_id
  where d.hostname = lower(p_hostname) and d.status = 'active' and t.status = 'active' limit 1;
$$;
grant execute on function public.resolve_tenant_slug(text) to anon, authenticated, service_role;
