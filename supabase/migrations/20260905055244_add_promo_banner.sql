create table public.site_settings (
    id text primary key,
    promo_active boolean not null default false,
    promo_text text,
    promo_link_url text,
    promo_link_text text
);

alter table public.site_settings enable row level security;
create policy "site_settings view is public" on public.site_settings for select using (true);
create policy "admin can do all on site_settings" on public.site_settings for all to authenticated using (true) with check (true);

insert into public.site_settings (id, promo_active, promo_text, promo_link_url, promo_link_text)
values ('global', false, 'Ganhe 20% off na sua primeira visita!', '#', 'Agendar com desconto');
