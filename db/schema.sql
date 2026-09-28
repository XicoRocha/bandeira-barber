-- Bandeira Barber — esquema da base de dados (Postgres / Supabase)
-- Correr uma vez no SQL Editor do Supabase (ou `npm run db:setup`).

create extension if not exists btree_gist;

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default 'Bandeira Barber',
  address text not null default '',
  phone text not null default '',
  instagram text not null default '',
  slot_minutes int not null default 15,        -- granularidade dos horários propostos
  min_notice_minutes int not null default 60,  -- antecedência mínima para marcar
  max_days_ahead int not null default 30,      -- quantos dias à frente se pode marcar
  cancel_limit_hours int not null default 2    -- até quantas horas antes o cliente pode cancelar
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists barbers (
  id serial primary key,
  name text not null,
  active boolean not null default true,
  sort int not null default 0
);

-- Contas de acesso à área de gestão
create table if not exists staff (
  id serial primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null default 'owner' check (role in ('owner', 'barber')),
  barber_id int references barbers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id serial primary key,
  name text not null,
  description text not null default '',
  duration_min int not null check (duration_min > 0),
  price_cents int not null check (price_cents >= 0),
  active boolean not null default true,
  sort int not null default 0
);

-- Horário semanal por barbeiro. weekday: 0=domingo … 6=sábado. Vários blocos por dia (ex.: manhã e tarde).
create table if not exists working_hours (
  id serial primary key,
  barber_id int not null references barbers(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
create index if not exists working_hours_barber on working_hours (barber_id, weekday);

-- Folgas, férias, pausas pontuais
create table if not exists time_off (
  id serial primary key,
  barber_id int not null references barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text not null default ''
);
create index if not exists time_off_barber on time_off (barber_id, starts_at);

create table if not exists customers (
  id serial primary key,
  name text not null,
  phone text not null unique,   -- formato normalizado, ex.: +351912345678
  email text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id serial primary key,
  barber_id int not null references barbers(id),
  service_id int not null references services(id),
  customer_id int not null references customers(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  price_cents int not null,
  status text not null default 'booked'
    check (status in ('booked', 'completed', 'cancelled', 'no_show')),
  source text not null default 'online' check (source in ('online', 'admin')),
  notes text not null default '',
  token text not null unique,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  -- Impede duas marcações sobrepostas para o mesmo barbeiro (mesmo com pedidos em simultâneo)
  constraint no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('booked', 'completed'))
);
create index if not exists appointments_starts on appointments (starts_at);
create index if not exists appointments_customer on appointments (customer_id);

-- Tudo é acedido só pelo servidor. Com RLS ativo e sem políticas, a API pública do Supabase não expõe nada.
alter table settings enable row level security;
alter table barbers enable row level security;
alter table staff enable row level security;
alter table services enable row level security;
alter table working_hours enable row level security;
alter table time_off enable row level security;
alter table customers enable row level security;
alter table appointments enable row level security;
