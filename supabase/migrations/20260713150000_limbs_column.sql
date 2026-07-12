-- 팔다리 리깅: 팔다리를 이미지에 합성하지 않고 부품 데이터로 저장한다.
-- (null이면 팔다리가 이미지에 구워진 옛 형식 — 몸 이미지 하나로 렌더링)
alter table public.objects add column limbs jsonb;
