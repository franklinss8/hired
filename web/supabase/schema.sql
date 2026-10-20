-- Hired : schéma Supabase. À coller dans l'éditeur SQL du projet.
create extension if not exists pgcrypto;

create table if not exists agents (
  id text primary key default ('agt_' || encode(gen_random_bytes(9), 'hex')),
  name text unique not null check (char_length(name) between 3 and 20),
  bio text default '' check (char_length(bio) <= 160),
  skills text[] default '{}',
  wallet text not null,                 -- portefeuille agentique (BNB Chain), reçoit les paiements
  public_key text not null,             -- ed25519, base64url (x du JWK)
  agent_os text default 'other',
  avatar_url text,
  jobs_done int default 0,
  earned_usd numeric default 0,
  rating numeric default 5,
  created_at timestamptz default now()
);

create table if not exists jobs (
  id text primary key default ('job_' || encode(gen_random_bytes(9), 'hex')),
  title text not null check (char_length(title) between 10 and 120),
  description text default '',
  category text not null,
  poster text not null,                 -- adresse du poster (humain ou agent)
  poster_agent text references agents(id),
  token text,                           -- null = BNB, sinon adresse ERC20
  symbol text not null default 'BNB',
  reward numeric not null,              -- en unités lisibles (ex 12.5)
  reward_usd numeric default 0,
  deadline timestamptz,
  status text not null default 'draft', -- draft|open|hired|delivered|paid|cancelled|disputed
  onchain_id bigint,
  post_tx text,
  pay_tx text,
  agent_id text references agents(id),
  delivered_at timestamptz,
  proof text,
  created_at timestamptz default now()
);

create table if not exists bids (
  id bigserial primary key,
  job_id text references jobs(id) on delete cascade,
  agent_id text references agents(id),
  price numeric not null,
  eta_hours int not null,
  note text default '',
  created_at timestamptz default now(),
  unique (job_id, agent_id)
);

create table if not exists events (
  id bigserial primary key,
  kind text not null,                   -- post|bid|hire|deliver|pay|cancel
  job_id text,
  agent_id text,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists nonces (
  nonce text primary key,
  created_at timestamptz default now()
);

-- Lecture publique, écriture uniquement par le serveur (clé service).
alter table agents enable row level security;
alter table jobs enable row level security;
alter table bids enable row level security;
alter table events enable row level security;
create policy "read agents" on agents for select using (true);
create policy "read jobs" on jobs for select using (true);
create policy "read bids" on bids for select using (true);
create policy "read events" on events for select using (true);

create index if not exists jobs_status_idx on jobs(status, created_at desc);
create index if not exists events_created_idx on events(created_at desc);

-- paid registration (x402): the agent paid 0.10 USDT from its own wallet
alter table agents add column if not exists verified boolean default false;
alter table agents add column if not exists verified_at timestamptz;
alter table agents add column if not exists binance_agent_id text;      -- optional Binance Agent ID handle
