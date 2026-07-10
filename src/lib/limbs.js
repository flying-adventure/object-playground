// 누끼 이미지에 카툰 팔다리를 랜덤으로 붙여 PNG 한 장으로 합성하는 모듈.
// 팔다리 그림은 임시(placeholder) SVG — 나중에 진짜 에셋으로 파일만 교체하면 된다.
import { blobToImage, loadImage } from './imageUtils'
import armWave from '../assets/limbs/arm-wave.svg'
import armStraight from '../assets/limbs/arm-straight.svg'
import armDown from '../assets/limbs/arm-down.svg'
import legRed from '../assets/limbs/leg-red.svg'
import legBlue from '../assets/limbs/leg-blue.svg'
import legYellow from '../assets/limbs/leg-yellow.svg'

// root: 팔다리가 몸에 붙는 지점의 좌표 (SVG viewBox 120x120 기준)
const ARMS = [
  { url: armWave, root: [12, 62] },
  { url: armStraight, root: [12, 60] },
  { url: armDown, root: [12, 54] },
]
const LEGS = [
  { url: legRed, root: [60, 12] },
  { url: legBlue, root: [60, 12] },
  { url: legYellow, root: [60, 12] },
]
const REACH = 95 // 팔다리 SVG에서 root부터 끝까지의 대략적인 길이(px)

const rand = (min, max) => min + Math.random() * (max - min)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

// 누끼 PNG Blob → 팔다리가 합성된 PNG { blob, width, height }
export async function attachLimbs(cutoutBlob) {
  const img = await blobToImage(cutoutBlob)

  // 1) 투명하지 않은 픽셀 영역(= 실제 사물)의 바운딩 박스 찾기
  const src = canvasOf(img)
  const box = findOpaqueBox(src)
  if (!box) throw new Error('누끼 결과가 비어 있음')

  // 2) 팔다리 길이는 몸 크기에 비례 (너무 작거나 크지 않게 제한)
  const scale = clamp(Math.max(box.w, box.h) * 0.5, 50, 220) / REACH
  const pad = 120 * scale // 팔다리가 몸 밖으로 뻗을 수 있는 여백

  const out = document.createElement('canvas')
  out.width = Math.ceil(box.w + pad * 2)
  out.height = Math.ceil(box.h + pad * 2)
  const ctx = out.getContext('2d')
  const bx = pad // 몸이 그려질 위치
  const by = pad

  // 3) 팔다리를 먼저 그리고(몸 뒤에 깔리도록) 몸을 나중에 그린다
  const armL = pick(ARMS)
  const armR = pick(ARMS)
  const legL = pick(LEGS)
  const legR = pick(LEGS)
  const [armLImg, armRImg, legLImg, legRImg] = await Promise.all(
    [armL, armR, legL, legR].map((l) => loadImage(l.url)),
  )

  // 어깨는 몸 가장자리보다 살짝 안쪽에 → 붙는 지점이 몸에 가려진다
  drawLimb(ctx, armLImg, armL.root, bx + box.w * 0.06, by + box.h * rand(0.25, 0.45), rand(-0.25, 0.25), scale, true)
  drawLimb(ctx, armRImg, armR.root, bx + box.w * 0.94, by + box.h * rand(0.25, 0.45), rand(-0.25, 0.25), scale, false)
  drawLimb(ctx, legLImg, legL.root, bx + box.w * rand(0.2, 0.35), by + box.h * 0.96, rand(-0.12, 0.12), scale, Math.random() < 0.5)
  drawLimb(ctx, legRImg, legR.root, bx + box.w * rand(0.65, 0.8), by + box.h * 0.96, rand(-0.12, 0.12), scale, Math.random() < 0.5)

  ctx.drawImage(src, box.x, box.y, box.w, box.h, bx, by, box.w, box.h)

  // 4) 남은 투명 여백을 잘라내고 최종 PNG로
  const trimmed = trim(out)
  const blob = await new Promise((resolve) => trimmed.toBlob(resolve, 'image/png'))
  return { blob, width: trimmed.width, height: trimmed.height }
}

// (x, y)에 root가 오도록 팔다리를 회전·반전해서 그린다
function drawLimb(ctx, img, root, x, y, angle, scale, flip) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(flip ? -scale : scale, scale)
  ctx.drawImage(img, -root[0], -root[1])
  ctx.restore()
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

// 캔버스의 투명 여백을 잘라낸 새 캔버스를 반환
function trim(canvas) {
  const box = findOpaqueBox(canvas)
  if (!box) return canvas
  const margin = 2
  const out = document.createElement('canvas')
  out.width = box.w + margin * 2
  out.height = box.h + margin * 2
  out.getContext('2d').drawImage(canvas, box.x, box.y, box.w, box.h, margin, margin, box.w, box.h)
  return out
}
