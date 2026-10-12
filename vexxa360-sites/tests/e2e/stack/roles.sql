-- Define as senhas dos papéis internos do Supabase (o compose oficial faz isso com roles.sql).
alter user authenticator with password 'postgres';
alter user pgbouncer with password 'postgres';
alter user supabase_auth_admin with password 'postgres';
alter user supabase_storage_admin with password 'postgres';
