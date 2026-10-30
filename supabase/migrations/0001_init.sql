-- TIP · esquema inicial
-- Una empresa por usuario y sus movimientos. Cada usuario ve y modifica solo lo suyo (RLS).
-- Pegalo completo en Supabase → SQL Editor → Run.

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  caja_ars numeric(18, 2) not null default 0 check (caja_ars >= 0),
  caja_usd numeric(18, 2) not null default 0 check (caja_usd >= 0),
  tipo_cambio numeric(14, 4) not null check (tipo_cambio > 0),
  devaluacion_mensual numeric(7, 3) not null default 0 check (devaluacion_mensual between -50 and 100),
  saldo_minimo numeric(18, 2) not null default 0 check (saldo_minimo >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.movimientos (
  -- El id lo genera la app al abrir el formulario: guardar dos veces el mismo movimiento no lo duplica.
  id uuid primary key,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null check (tipo in ('cobro', 'pago', 'impuesto')),
  concepto text not null check (char_length(concepto) between 1 and 120),
  monto numeric(18, 2) not null check (monto > 0),
  moneda text not null check (moneda in ('ARS', 'USD')),
  fecha date not null,
  puntualidad smallint check (puntualidad between 0 and 100),
  creado_en timestamptz not null default now(),
  constraint puntualidad_solo_en_cobros check (tipo = 'cobro' or puntualidad is null)
);

create index if not exists movimientos_empresa_fecha on public.movimientos (empresa_id, fecha);

-- Seguridad a nivel de fila --------------------------------------------------

alter table public.empresas enable row level security;
alter table public.movimientos enable row level security;

drop policy if exists "empresas: ver la propia" on public.empresas;
drop policy if exists "empresas: crear la propia" on public.empresas;
drop policy if exists "empresas: editar la propia" on public.empresas;
drop policy if exists "empresas: borrar la propia" on public.empresas;

create policy "empresas: ver la propia" on public.empresas
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "empresas: crear la propia" on public.empresas
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "empresas: editar la propia" on public.empresas
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "empresas: borrar la propia" on public.empresas
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.es_mi_empresa(p_empresa uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.empresas e where e.id = p_empresa and e.user_id = (select auth.uid()));
$$;

drop policy if exists "movimientos: ver los propios" on public.movimientos;
drop policy if exists "movimientos: crear en la empresa propia" on public.movimientos;
drop policy if exists "movimientos: editar los propios" on public.movimientos;
drop policy if exists "movimientos: borrar los propios" on public.movimientos;

create policy "movimientos: ver los propios" on public.movimientos
  for select to authenticated using (public.es_mi_empresa(empresa_id));
create policy "movimientos: crear en la empresa propia" on public.movimientos
  for insert to authenticated with check (public.es_mi_empresa(empresa_id));
create policy "movimientos: editar los propios" on public.movimientos
  for update to authenticated using (public.es_mi_empresa(empresa_id)) with check (public.es_mi_empresa(empresa_id));
create policy "movimientos: borrar los propios" on public.movimientos
  for delete to authenticated using (public.es_mi_empresa(empresa_id));

-- Los visitantes sin sesión no tienen acceso a nada.
revoke all on public.empresas, public.movimientos from anon;

-- Importación en un solo paso ------------------------------------------------
-- Agrega (o reemplaza) movimientos de la empresa del usuario. Corre con los permisos
-- del usuario (security invoker), así que las políticas RLS se aplican igual.

create or replace function public.importar_movimientos(p_movimientos jsonb, p_reemplazar boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select id into v_empresa from public.empresas where user_id = (select auth.uid());
  if v_empresa is null then
    raise exception 'El usuario no tiene empresa';
  end if;
  if jsonb_array_length(p_movimientos) > 2000 then
    raise exception 'Demasiados movimientos';
  end if;

  if p_reemplazar then
    delete from public.movimientos where empresa_id = v_empresa;
  end if;

  insert into public.movimientos (id, empresa_id, tipo, concepto, monto, moneda, fecha, puntualidad)
  select
    (m ->> 'id')::uuid,
    v_empresa,
    m ->> 'tipo',
    m ->> 'concepto',
    (m ->> 'monto')::numeric,
    m ->> 'moneda',
    (m ->> 'fecha')::date,
    nullif(m ->> 'puntualidad', '')::smallint
  from jsonb_array_elements(p_movimientos) as m
  on conflict (id) do nothing;
end;
$$;

revoke execute on function public.importar_movimientos(jsonb, boolean) from public, anon;
grant execute on function public.importar_movimientos(jsonb, boolean) to authenticated;
revoke execute on function public.es_mi_empresa(uuid) from public, anon;
grant execute on function public.es_mi_empresa(uuid) to authenticated;
