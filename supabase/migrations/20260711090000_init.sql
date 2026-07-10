-- soma-landing 5단계: 공유 놀이터를 위한 Supabase 초기 설정.
-- (Supabase 대시보드 SQL Editor에 붙여넣거나 CLI로 실행)

-- 사물 목록 테이블
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  image_path text not null, -- Storage에 올린 합성 PNG 경로
  created_at timestamptz not null default now()
);

-- RLS(행 단위 권한): 익명 사용자는 보기·올리기만 가능, 수정·삭제 불가
alter table public.objects enable row level security;

create policy "anyone can read objects"
  on public.objects for select using (true);

create policy "anyone can insert objects"
  on public.objects for insert with check (true);

-- 실시간(INSERT 알림) 켜기 — 새 사물이 모두의 화면에 바로 떨어지게
alter publication supabase_realtime add table public.objects;

-- 이미지 저장 버킷 (public: URL만 알면 볼 수 있음, 파일당 최대 5MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('objects', 'objects', true, 5242880);

create policy "anyone can upload object images"
  on storage.objects for insert
  with check (bucket_id = 'objects');

create policy "anyone can view object images"
  on storage.objects for select
  using (bucket_id = 'objects');
