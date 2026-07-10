// 오래된 사물 청소 함수: 생성된 지 RETENTION_DAYS 지난 사물의
// 이미지 파일(Storage)과 목록 행(objects 테이블)을 함께 삭제한다.
// pg_cron이 매일 한 번 호출한다 (수동 호출해도 안전 — 같은 일만 반복).
import { createClient } from 'npm:@supabase/supabase-js@2'

const RETENTION_DAYS = 7 // 보관 기간(일) — 바꾸고 싶으면 이 숫자만 수정

Deno.serve(async () => {
  // 서비스 롤 키(관리자 권한)는 Supabase가 함수 환경에 자동 주입한다
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // 1) 기한 지난 행 찾기 (한 번에 최대 500개 — 다음 실행 때 이어서 지움)
  const { data: expired, error: selectError } = await supabase
    .from('objects')
    .select('id, image_path')
    .lt('created_at', cutoff)
    .limit(500)
  if (selectError) return Response.json({ error: selectError.message }, { status: 500 })
  if (!expired.length) return Response.json({ deleted: 0 })

  // 2) 이미지 파일 먼저 삭제 (행을 먼저 지우면 실패 시 파일이 고아가 된다)
  const { error: removeError } = await supabase.storage
    .from('objects')
    .remove(expired.map((row) => row.image_path))
  if (removeError) return Response.json({ error: removeError.message }, { status: 500 })

  // 3) 목록 행 삭제
  const { error: deleteError } = await supabase
    .from('objects')
    .delete()
    .in('id', expired.map((row) => row.id))
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 })

  return Response.json({ deleted: expired.length })
})
