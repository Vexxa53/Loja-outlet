-- Vexxa360° Sites — 0004: Storage
-- Bucket único e PÚBLICO para mídia da vitrine (fotos de produtos, logotipos, banners).
-- Só conteúdo destinado ao público vai aqui. Leitura pública por URL; ESCRITA só por
-- membros da loja dentro da pasta "<tenant_id>/...".
-- O servidor Next.js ainda gera o caminho (nunca aceita caminho livre do navegador).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 4194304,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A primeira pasta do caminho precisa ser o id de uma loja onde o usuário tem papel de escrita.
create or replace function public.can_write_store_media(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id::text = (storage.foldername(p_name))[1]
      and m.role in ('owner', 'admin', 'staff')
  );
$$;
grant execute on function public.can_write_store_media(text) to authenticated;

-- (RLS já vem habilitado em storage.objects no Supabase)
drop policy if exists "store_media_public_read" on storage.objects;
create policy "store_media_public_read" on storage.objects for select
  using (bucket_id = 'store-media');

drop policy if exists "store_media_member_insert" on storage.objects;
create policy "store_media_member_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'store-media' and public.can_write_store_media(name));

drop policy if exists "store_media_member_update" on storage.objects;
create policy "store_media_member_update" on storage.objects for update to authenticated
  using (bucket_id = 'store-media' and public.can_write_store_media(name))
  with check (bucket_id = 'store-media' and public.can_write_store_media(name));

drop policy if exists "store_media_member_delete" on storage.objects;
create policy "store_media_member_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'store-media' and public.can_write_store_media(name));
