// 누끼 이미지에서 몸을 잘라내고, 붙일 팔다리를 "부품 데이터"로 고른다.
// 팔다리를 이미지에 합성하지 않으므로 렌더링(objectView.js)에서
// 부품을 회전시켜 앉기 같은 포즈를 만들 수 있다.
import { blobToImage } from './imageUtils'
import { ARM_KINDS, LEG_KINDS } from './limbAssets'

const rand = (min, max) => min + Math.random() * (max - min)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// 누끼 PNG → { bodyBlob(몸만 잘라낸 PNG), width, height, limbs(팔다리 부품 데이터) }
export async function generateLimbs(cutoutBlob) {
  const img = await blobToImage(cutoutBlob)

  // 1) 투명하지 않은 픽셀 영역(= 실제 사물)만 잘라낸다
  const src = canvasOf(img)
  const box = findOpaqueBox(src)
  if (!box) throw new Error('누끼 결과가 비어 있음')
  const margin = 2
  const out = document.createElement('canvas')
  out.width = box.w + margin * 2
  out.height = box.h + margin * 2
  out.getContext('2d').drawImage(src, box.x, box.y, box.w, box.h, margin, margin, box.w, box.h)
  const bodyBlob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'))

  // 2) 팔다리 부품 랜덤 선택 — ax/ay는 몸 대비 비율 좌표(0~1), angle은 기본 각도
  const limbs = {
    size: 0.63, // 팔다리 그림 크기 = 몸 긴 변 대비 비율
    parts: [
      { role: 'armL', kind: pick(ARM_KINDS), ax: 0.06, ay: rand(0.25, 0.45), angle: rand(-0.25, 0.25), flip: true },
      { role: 'armR', kind: pick(ARM_KINDS), ax: 0.94, ay: rand(0.25, 0.45), angle: rand(-0.25, 0.25), flip: false },
      { role: 'legL', kind: pick(LEG_KINDS), ax: rand(0.2, 0.35), ay: 0.96, angle: rand(-0.12, 0.12), flip: true },
      { role: 'legR', kind: pick(LEG_KINDS), ax: rand(0.65, 0.8), ay: 0.96, angle: rand(-0.12, 0.12), flip: false },
    ],
  }

  return { bodyBlob, width: out.width, height: out.height, limbs }
}

function canvasOf(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d').drawImage(img, 0, 0)
  return canvas
}

// 알파(투명도)가 있는 픽셀들의 최소 사각형을 찾는다. 전부 투명이면 null
function findOpaqueBox(canvas) {
  const { width: w, height: h } = canvas
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}
