// 사물 DOM 만들기: 몸 이미지 + 팔다리 레이어.
// 팔다리는 별도 <img>라서 붙는 지점(root)을 축으로 회전시킬 수 있다 → 포즈 애니메이션.
// limbs가 없으면(팔다리가 이미지에 구워진 옛 데이터) 몸 이미지 하나만 그린다.
import { LIMB_ASSETS, LIMB_SIZE } from './limbAssets'

// 포즈: 역할별 추가 회전(라디안). 기본 각도에 더해진다
export const POSES = {
  idle: {},
  study: { legL: -1.15, legR: -1.35, armR: 0.35, armL: 0.15 }, // 다리는 책상 쪽으로, 팔은 책상 위로
}

export function createObjectEl({ url, w, h, limbs }) {
  const el = document.createElement('div')
  el.className = 'obj'
  el.style.width = `${w}px`
  el.style.height = `${h}px`

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
      limbEl.style.left = `${part.ax * w - asset.root[0] * k}px`
      limbEl.style.top = `${part.ay * h - asset.root[1] * k}px`
      limbEl.style.transformOrigin = `${asset.root[0] * k}px ${asset.root[1] * k}px`
      setLimbTransform(limbEl, part, 0)
      el.appendChild(limbEl) // 몸보다 먼저 넣어 몸 뒤에 깔린다
      parts[part.role] = { el: limbEl, part }
    }
  }

  const bodyEl = document.createElement('img')
  bodyEl.src = url
  bodyEl.className = 'body'
  el.appendChild(bodyEl)

  function setPose(pose) {
    for (const role in parts) {
      const { el: limbEl, part } = parts[role]
      setLimbTransform(limbEl, part, pose[role] || 0)
    }
  }

  return { el, setPose }
}

function setLimbTransform(limbEl, part, poseDelta) {
  // scaleX(반전)를 먼저, 회전은 화면 기준으로 — 반전돼도 회전 방향이 일정하다
  limbEl.style.transform = `rotate(${part.angle + poseDelta}rad) scaleX(${part.flip ? -1 : 1})`
}
