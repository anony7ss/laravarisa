-- Execute este arquivo uma única vez no SQL Editor do projeto.
-- Ele também pode ser executado novamente com segurança para restaurar a função de admin.

begin;

do $$
declare
  target_user_id constant uuid := 'e5e70f48-dce7-4e49-ab29-9ec69cdb7bb2';
  target_email constant text := 'teste@gmail.com';
  target_name constant text := 'Administrador';
  authenticated_email text;
begin
  select lower(email)
    into authenticated_email
    from auth.users
   where id = target_user_id
   for update;

  if authenticated_email is null then
    raise exception 'Usuário não encontrado para o UID informado.';
  end if;

  if authenticated_email <> lower(target_email) then
    raise exception 'O e-mail do usuário não corresponde ao UID informado.';
  end if;

  insert into public.profiles (id, full_name, role)
  values (target_user_id, target_name, 'admin'::public.app_role)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = 'admin'::public.app_role,
        updated_at = now();
end;
$$;

commit;

-- Confirma o resultado sem exibir dados sensíveis da autenticação.
select id, full_name, role, created_at, updated_at
  from public.profiles
 where id = 'e5e70f48-dce7-4e49-ab29-9ec69cdb7bb2';
