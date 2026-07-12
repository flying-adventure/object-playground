// Supabase 연동: 사물 PNG 업로드 + 기존 목록 불러오기 + 실시간 구독.
// 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 없으면
// 연동 없이 "로컬 전용 모드"로 동작한다 (혼자 노는 놀이터).
import { createClient } from '@supabase/supabase-js'

// 붙여넣기 과정에서 섞여 들어갈 수 있는 공백·줄바꿈 제거 (URL·키에는 원래 공백이 없다)
const clean = (value) => (value || '').replace(/\s+/g, '')
const url = clean(import.meta.env.VITE_SUPABASE_URL)
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)
const supabase = url && anonKey ? createClient(url, anonKey) : null

export const isShared = !!supabase // 공유 모드 여부

const seenIds = new Set() // 내가 올린 것이 실시간 알림으로 또 와서 중복되는 것 방지

// 몸 PNG를 저장소에 올리고 팔다리 부품 데이터와 함께 목록 테이블에 기록
export async function uploadObject(blob, limbs) {
  const path = `${crypto.randomUUID()}.png`
  const { error: uploadError } = await supabase.storage
    .from('objects')
    .upload(path, blob, { contentType: 'image/png' })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('objects')
    .insert({ image_path: path, limbs })
    .select('id')
    .single()
  if (error) throw error
  seenIds.add(data.id)
}

// 최근 사물들 { url, limbs } (오래된 것 → 새것 순서)
export async function listRecent(limit = 30) {
  const { data, error } = await supabase
    .from('objects')
    .select('id, image_path, limbs')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  for (const row of data) seenIds.add(row.id)
  return data.reverse().map((row) => ({ url: publicUrl(row.image_path), limbs: row.limbs }))
}

// 누군가 새 사물을 올리면 콜백 호출. 반환값은 콜백 해제 함수.
// 웹소켓 채널은 페이지당 한 번만 만들어 계속 유지한다 — React StrictMode가
// 마운트를 두 번 돌릴 때 구독을 껐다 켜면 연결이 끊기는 경쟁 상태가 생기기 때문.
const listeners = new Set()
let channelStarted = false

export function onNewObject(callback) {
  listeners.add(callback)
  if (!channelStarted) {
    channelStarted = true
    supabase
      .channel('objects-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'objects' },
        ({ new: row }) => {
          if (seenIds.has(row.id)) return
          seenIds.add(row.id)
          const item = { url: publicUrl(row.image_path), limbs: row.limbs }
          for (const listener of listeners) listener(item)
        },
      )
      .subscribe((status, err) => {
        if (err || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('실시간 구독 문제:', status, err)
        }
      })
  }
  return () => listeners.delete(callback)
}

function publicUrl(path) {
  return supabase.storage.from('objects').getPublicUrl(path).data.publicUrl
}
