-- 6단계: 오래된 사물 자동 청소 스케줄.
-- pg_cron(DB 내장 스케줄러)이 매일 한 번 cleanup 함수를 HTTP로 호출한다.
-- (anon 키는 앱 번들에도 들어가는 공개 키라 여기 적어도 안전)

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cleanup-old-objects',
  '0 18 * * *', -- 매일 18:00 UTC = 한국시간 새벽 3시
  $$
  select net.http_post(
    url := 'https://eqxzdabwcsnykbhfuplq.supabase.co/functions/v1/cleanup',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxeHpkYWJ3Y3NueWtiaGZ1cGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODYzNDQsImV4cCI6MjA5OTI2MjM0NH0.EIZSDgCiRMnq_EWULgVN0jbL04yH-NdbLhyCU-_J8so", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
