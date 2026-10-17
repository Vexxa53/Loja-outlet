-- Produtos de EXEMPLO para o Outlet 3K (6 categorias x 3 produtos). Rode no SQL Editor do Supabase.
-- Pode rodar mais de uma vez (não duplica). Troque por produtos e fotos reais em Admin > Produtos.
-- Preços e nomes são fictícios, só para a vitrine não ficar vazia.
DO $$
DECLARE
  c record; p record; v text; cid text; pid text; n int := 0; i int;
  cats text[][] := ARRAY[
    ['camisetas-de-grife','Camisetas de grife','1'],
    ['tenis','Tênis','2'],
    ['calcas','Calças','3'],
    ['relogios','Relógios','4'],
    ['acessorios','Acessórios','5'],
    ['perfumes','Perfumes','6']];
  names text[][] := ARRAY[
    ['camisetas-de-grife','Camiseta Premium Preta','CAM-001','19900','12990','P,M,G,GG','Preto'],
    ['camisetas-de-grife','Camiseta Premium Branca','CAM-002','19900',NULL,'P,M,G,GG','Branco'],
    ['camisetas-de-grife','Camiseta Oversized Grafite','CAM-003','22900','15990','P,M,G,GG','Grafite'],
    ['tenis','Tênis Urbano Preto','TEN-001','49900','34990','38,39,40,41,42,43','Preto'],
    ['tenis','Tênis Casual Branco','TEN-002','44900',NULL,'38,39,40,41,42,43','Branco'],
    ['tenis','Tênis Esportivo Cinza','TEN-003','52900','39990','38,39,40,41,42,43','Cinza'],
    ['calcas','Calça Jeans Slim','CAL-001','27900','19990','38,40,42,44,46','Azul'],
    ['calcas','Calça Jogger Preta','CAL-002','24900',NULL,'P,M,G,GG','Preto'],
    ['calcas','Calça Cargo Grafite','CAL-003','29900','21990','38,40,42,44,46','Grafite'],
    ['relogios','Relógio Analógico Preto','REL-001','59900','42990','Único','Preto'],
    ['relogios','Relógio Digital Esportivo','REL-002','39900',NULL,'Único','Preto'],
    ['relogios','Relógio Clássico Prata','REL-003','69900','49990','Único','Prata'],
    ['acessorios','Boné Aba Curva','ACE-001','12900','8990','Único','Preto'],
    ['acessorios','Cinto de Couro','ACE-002','14900',NULL,'Único','Preto'],
    ['acessorios','Carteira Slim','ACE-003','16900','11990','Único','Marrom'],
    ['perfumes','Perfume Masculino 100ml','PER-001','34900','24990','100ml','Único'],
    ['perfumes','Perfume Feminino 100ml','PER-002','34900',NULL,'100ml','Único'],
    ['perfumes','Perfume Unissex 50ml','PER-003','27900','19990','50ml','Único']];
BEGIN
  FOREACH i IN ARRAY ARRAY[1,2,3,4,5,6] LOOP
    INSERT INTO "Category" ("id","name","slug","position","active")
    VALUES (gen_random_uuid()::text, cats[i][2], cats[i][1], cats[i][3]::int, true)
    ON CONFLICT ("slug") DO NOTHING;
  END LOOP;

  FOR i IN 1..array_length(names,1) LOOP
    SELECT "id" INTO cid FROM "Category" WHERE "slug" = names[i][1];
    IF EXISTS (SELECT 1 FROM "Product" WHERE "sku" = names[i][3]) THEN CONTINUE; END IF;
    pid := gen_random_uuid()::text;
    INSERT INTO "Product" ("id","name","slug","description","sku","categoryId","costCents","priceCents","promoPriceCents","status","featured","isNew","updatedAt")
    VALUES (pid, names[i][2], lower(names[i][3]), 'Produto de exemplo. Substitua pelo seu produto real no painel.', names[i][3], cid,
            (names[i][4]::int * 0.5)::int, names[i][4]::int, names[i][5]::int, 'PUBLISHED', (i % 3 = 1), (i % 3 <> 0), now());
    INSERT INTO "ProductImage" ("id","productId","url","position") VALUES (gen_random_uuid()::text, pid, '/demo/' || names[i][1] || '.svg', 0);
    FOREACH v IN ARRAY string_to_array(names[i][6], ',') LOOP
      INSERT INTO "Variant" ("id","productId","sku","size","color","stock","minStock")
      VALUES (gen_random_uuid()::text, pid, names[i][3] || '-' || upper(replace(v,' ','')), v, names[i][7], 10, 2);
    END LOOP;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Produtos criados: %', n;
END $$;

-- Segurança: mantém o acesso público bloqueado nas tabelas novas (idempotente)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
