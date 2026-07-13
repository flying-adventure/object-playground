// 팔다리 에셋 등록부 — 생성(limbs.js)과 렌더링(objectView.js)이 함께 사용한다.
// 팔다리는 관절이 있는 두 마디: 위마디(어깨/엉덩이 → 팔꿈치/무릎) + 아래마디(→ 손/발).
// root: 붙는 지점, tip: 관절 지점 (SVG viewBox 120x120 기준)
import armUpper from '../assets/limbs/arm-upper.svg'
import armLower from '../assets/limbs/arm-lower.svg'
import legUpper from '../assets/limbs/leg-upper.svg'
import legLowerRed from '../assets/limbs/leg-lower-red.svg'
import legLowerBlue from '../assets/limbs/leg-lower-blue.svg'
import legLowerYellow from '../assets/limbs/leg-lower-yellow.svg'

export const LIMB_SIZE = 120 // SVG 원본 크기

export const SEGMENTS = {
  arm: {
    upper: { url: armUpper, root: [14, 60], tip: [62, 60] },
    lowers: { default: { url: armLower, root: [14, 60] } },
  },
  leg: {
    upper: { url: legUpper, root: [60, 14], tip: [60, 62] },
    lowers: {
      red: { url: legLowerRed, root: [60, 14] },
      blue: { url: legLowerBlue, root: [60, 14] },
      yellow: { url: legLowerYellow, root: [60, 14] },
    },
  },
}

// 종류명(kind) → 마디 구성. bend는 기본 관절 각도 —
// 기존 DB 데이터의 kind도 그대로 관절 버전으로 해석된다
export const KIND_MAP = {
  'arm-wave': { type: 'arm', color: 'default', bend: -0.9 }, // 팔꿈치 위로
  'arm-straight': { type: 'arm', color: 'default', bend: 0.12 },
  'arm-down': { type: 'arm', color: 'default', bend: 0.7 }, // 팔꿈치 아래로
  'leg-red': { type: 'leg', color: 'red', bend: 0.12 },
  'leg-blue': { type: 'leg', color: 'blue', bend: -0.12 },
  'leg-yellow': { type: 'leg', color: 'yellow', bend: 0.08 },
}

export const ARM_KINDS = ['arm-wave', 'arm-straight', 'arm-down']
export const LEG_KINDS = ['leg-red', 'leg-blue', 'leg-yellow']
