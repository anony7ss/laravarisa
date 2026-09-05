-- Execute este comando no SQL Editor do seu projeto Supabase se precisar redefinir a senha do admin:
-- Substitua 'SUA_NOVA_SENHA_AQUI' pela senha desejada (mínimo de 8 caracteres).

begin;

update auth.users
set encrypted_password = extensions.crypt('SUA_NOVA_SENHA_AQUI', extensions.gen_salt('bf', 10)),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where lower(email) = lower('gabriel@gmail.com');

commit;

-- Verifique se o usuário continua com a role admin em public.profiles:
select u.id, u.email, u.email_confirmed_at, p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('gabriel@gmail.com');
