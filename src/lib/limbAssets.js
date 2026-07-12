// 팔다리 에셋 등록부 — 생성(limbs.js)과 렌더링(objectView.js)이 함께 사용한다.
// root: 팔다리가 몸에 붙는 지점의 좌표 (SVG viewBox 120x120 기준)
import armWave from '../assets/limbs/arm-wave.svg'
import armStraight from '../assets/limbs/arm-straight.svg'
import armDown from '../assets/limbs/arm-down.svg'
import legRed from '../assets/limbs/leg-red.svg'
import legBlue from '../assets/limbs/leg-blue.svg'
import legYellow from '../assets/limbs/leg-yellow.svg'

export const LIMB_SIZE = 120 // SVG 원본 크기

export const LIMB_ASSETS = {
  'arm-wave': { url: armWave, root: [12, 62] },
  'arm-straight': { url: armStraight, root: [12, 60] },
  'arm-down': { url: armDown, root: [12, 54] },
  'leg-red': { url: legRed, root: [60, 12] },
  'leg-blue': { url: legBlue, root: [60, 12] },
  'leg-yellow': { url: legYellow, root: [60, 12] },
}

export const ARM_KINDS = ['arm-wave', 'arm-straight', 'arm-down']
export const LEG_KINDS = ['leg-red', 'leg-blue', 'leg-yellow']
