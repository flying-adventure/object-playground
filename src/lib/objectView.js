// 사물 DOM 만들기: 몸 이미지 + 팔다리 레이어.
// 팔다리는 별도 <img>라서 붙는 지점(root)을 축으로 회전시킬 수 있다 → 포즈 애니메이션.
// limbs가 없으면(팔다리가 이미지에 구워진 옛 데이터) 몸 이미지 하나만 그린다.
import { LIMB_ASSETS, LIMB_SIZE } from './limbAssets'

// 포즈: 역할별 추가 회전(라디안). 기본 각도에 더해진다
export const POSES = {
  idle: {},
  study: { legL: -1.15, legR: -1.35, armR: 0.35, armL: 0.15 }, // 다리는 책상 쪽으로, 팔은 책상 위로
}

// 팔다리를 포함한 전체 크기(외곽 상자)를 계산한다.
// 물리 충돌 상자도 이 크기를 쓰므로 발이 바닥에 닿고, 팔다리가 벽 밖으로 안 나간다
export function computeExtents(w, h, limbs) {
  if (!limbs || !limbs.parts) return { extW: w, extH: h, padLeft: 0, padTop: 0 }
  const limbPx = limbs.size * Math.max(w, h)
  const padSide = limbPx * 0.8 // 좌우: 뻗은 팔 길이만큼
  const padTop = limbPx * 0.25 // 위: 들어 올린 손 높이만큼
  const padBottom = limbPx * 0.75 // 아래: 다리 길이만큼
  return { extW: w + padSide * 2, extH: h + padTop + padBottom, padLeft: padSide, padTop }
}

export function createObjectEl({ url, w, h, limbs }) {
  const { extW, extH, padLeft, padTop } = computeExtents(w, h, limbs)
  const el = document.createElement('div')
  el.className = 'obj'
  el.style.width = `${extW}px`
  el.style.height = `${extH}px`

  const parts = {} // role → { el, part }
  if (limbs && limbs.parts) {
    const px = limbs.size * Math.max(w, h) // 팔다리 그림 크기(px)
    const k = px / LIMB_SIZE
    for (const part of limbs.parts) {
      const asset = LIMB_ASSETS[part.kind]
      if (!asset) continue
      const limbEl = document.createElement('img')
      limbEl.src = asset.url
      limbEl.className = 'limb'
      limbEl.style.width = `${px}px`
      limbEl.style.height = `${px}px`
      // root가 몸의 부착점(ax, ay)에 오도록 배치하고, root를 회전축으로 삼는다
      limbEl.style.left = `${padLeft + part.ax * w - asset.root[0] * k}px`
      limbEl.style.top = `${padTop + part.ay * h - asset.root[1] * k}px`
      limbEl.style.transformOrigin = `${asset.root[0] * k}px ${asset.root[1] * k}px`
      setLimbTransform(limbEl, part, 0)
      el.appendChild(limbEl) // 몸보다 먼저 넣어 몸 뒤에 깔린다
      parts[part.role] = { el: limbEl, part }
    }
  }

  const bodyEl = document.createElement('img')
  bodyEl.src = url
  bodyEl.className = 'body'
  bodyEl.style.left = `${padLeft}px`
  bodyEl.style.top = `${padTop}px`
  bodyEl.style.width = `${w}px`
  bodyEl.style.height = `${h}px`
  el.appendChild(bodyEl)

  function setPose(pose) {
    for (const role in parts) {
      const { el: limbEl, part } = parts[role]
      setLimbTransform(limbEl, part, pose[role] || 0)
    }
  }

  return { el, setPose, extW, extH }
}

function setLimbTransform(limbEl, part, poseDelta) {
  // scaleX(반전)를 먼저, 회전은 화면 기준으로 — 반전돼도 회전 방향이 일정하다
  limbEl.style.transform = `rotate(${part.angle + poseDelta}rad) scaleX(${part.flip ? -1 : 1})`
}
