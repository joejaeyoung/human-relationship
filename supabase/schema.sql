-- 세션 상태 테이블 (단일 row)
create table session_state (
  id int primary key default 1,
  current_stage int default 0,
  phase text default 'intro',
  constraint single_row check (id = 1)
);

-- 초기 row 삽입
insert into session_state (id, current_stage, phase) values (1, 0, 'intro');

-- 투표 테이블
create table votes (
  id uuid primary key default gen_random_uuid(),
  stage int not null,
  choice text not null,
  created_at timestamptz default now()
);

-- Realtime 활성화
alter publication supabase_realtime add table session_state;
alter publication supabase_realtime add table votes;

-- RLS 정책 (anon 키로 읽기/쓰기 허용)
alter table session_state enable row level security;
create policy "read session" on session_state for select using (true);
create policy "update session" on session_state for update using (true);

alter table votes enable row level security;
create policy "read votes" on votes for select using (true);
create policy "insert votes" on votes for insert with check (true);
