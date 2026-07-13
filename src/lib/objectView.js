// 사물 DOM 만들기: 몸 이미지 + 관절 있는 팔다리(위마디+아래마디).
// 위마디는 어깨/엉덩이를 축으로, 아래마디는 팔꿈치/무릎을 축으로 회전한다 → 진짜 포즈.
// limbs가 없으면(팔다리가 이미지에 구워진 옛 데이터) 몸 이미지 하나만 그린다.
import { SEGMENTS, KIND_MAP, LIMB_SIZE } from './limbAssets'

// 포즈: 역할별 { u: 위마디(어깨·엉덩이) 회전, l: 아래마디(팔꿈치·무릎) 회전 } — 라디안, 화면 기준
export const POSES = {
  idle: {},
  // 의자에 앉아 공부: 무릎 90도, 오른팔은 팔꿈치를 굽혀 책상 위에
  study: {
    armL: { u: 0.3, l: -0.4 },
    armR: { u: 0.5, l: -0.95 },
    legL: { u: -1.3, l: 1.15 },
    legR: { u: -1.5, l: 1.35 },
  },
  // 사각사각 — 아래팔만 살짝 움직인 변형 (study와 번갈아 적용)
  studyAlt: {
    armL: { u: 0.3, l: -0.4 },
    armR: { u: 0.42, l: -0.7 },
    legL: { u: -1.3, l: 1.15 },
    legR: { u: -1.5, l: 1.35 },
  },
  // 트램펄린 점프: 만세 + 다리 벌리기
  jump: {
    armL: { u: 1.25, l: 0.45 },
    armR: { u: -1.25, l: -0.45 },
    legL: { u: 0.55, l: 0.4 },
    legR: { u: -0.55, l: -0.4 },
  },
}

// 팔다리를 포함한 전체 크기(외곽 상자)를 계산한다.
// 물리 충돌 상자도 이 크기를 쓰므로 발이 바닥에 닿고, 팔다리가 벽 밖으로 안 나간다
export function computeExtents(w, h, limbs) {
  if (!limbs || !limbs.parts) return { extW: w, extH: h, padLeft: 0, padTop: 0 }
  const limbPx = limbs.size * Math.max(w, h)
  const padSide = limbPx * 0.85 // 좌우: 뻗은 팔 길이만큼
  const padTop = limbPx * 0.5 // 위: 만세한 손 높이만큼
  const padBottom = limbPx * 0.9 // 아래: 다리 길이만큼
  return { extW: w + padSide * 2, extH: h + padTop + padBottom, padLeft: padSide, padTop }
}

export function createObjectEl({ url, w, h, limbs }) {
  const { extW, extH, padLeft, padTop } = computeExtents(w, h, limbs)
  const el = document.createElement('div')
  el.className = 'obj'
  el.style.width = `${extW}px`
  el.style.height = `${extH}px`

  const parts = {} // role → { upperEl, lowerEl, part, bend }
  if (limbs && limbs.parts) {
    const px = limbs.size * Math.max(w, h) // 팔다리 그림 크기(px)
    const k = px / LIMB_SIZE
    for (const part of limbs.parts) {
      const kind = KIND_MAP[part.kind]
      if (!kind) continue
      const upperAsset = SEGMENTS[kind.type].upper
      const lowerAsset = SEGMENTS[kind.type].lowers[kind.color]

      const upperEl = document.createElement('div')
      upperEl.className = 'limb'
      upperEl.style.width = `${px}px`
      upperEl.style.height = `${px}px`
      // root(어깨·엉덩이)가 몸의 부착점(ax, ay)에 오도록 배치하고, root를 회전축으로
      upperEl.style.left = `${padLeft + part.ax * w - upperAsset.root[0] * k}px`
      upperEl.style.top = `${padTop + part.ay * h - upperAsset.root[1] * k}px`
      upperEl.style.transformOrigin = `${upperAsset.root[0] * k}px ${upperAsset.root[1] * k}px`

      // 아래마디: 위마디의 tip(팔꿈치·무릎)에 root가 오도록 안에 배치
      const lowerEl = document.createElement('div')
      lowerEl.className = 'limb-lower'
      lowerEl.style.width = `${px}px`
      lowerEl.style.height = `${px}px`
      lowerEl.style.left = `${(upperAsset.tip[0] - lowerAsset.root[0]) * k}px`
      lowerEl.style.top = `${(upperAsset.tip[1] - lowerAsset.root[1]) * k}px`
      lowerEl.style.transformOrigin = `${lowerAsset.root[0] * k}px ${lowerAsset.root[1] * k}px`
      const lowerImg = document.createElement('img')
      lowerImg.src = lowerAsset.url
      lowerEl.appendChild(lowerImg)

      const upperImg = document.createElement('img')
      upperImg.src = upperAsset.url
      upperEl.appendChild(lowerEl)
      upperEl.appendChild(upperImg) // 관절 이음새는 위마디가 덮는다

      el.appendChild(upperEl)
      parts[part.role] = { upperEl, lowerEl, part, bend: kind.bend }
      applyLimb(parts[part.role], {})
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
    for (const role in parts) applyLimb(parts[role], pose)
  }

  return { el, setPose, extW, extH }
}

function applyLimb({ upperEl, lowerEl, part, bend }, pose) {
  const p = pose[part.role] || {}
  // 위마디: 반전(scaleX)을 먼저, 회전은 화면 기준 — 반전돼도 회전 방향이 일정하다
  upperEl.style.transform = `rotate(${part.angle + (p.u || 0)}rad) scaleX(${part.flip ? -1 : 1})`
  // 아래마디는 반전된 공간 안에 있으므로, 화면 기준으로 맞추려면 각도를 뒤집는다
  const l = bend + (p.l || 0)
  lowerEl.style.transform = `rotate(${part.flip ? -l : l}rad)`
}
