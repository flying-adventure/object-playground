// 누끼(배경 제거) 모듈.
// 2차 업그레이드("탭한 사물만 따기", SlimSAM)에서는 이 파일만 교체하면 된다.
import { removeBackground, preload } from '@imgly/background-removal'
import { blobToImage } from './imageUtils'

const MAX_DIM = 1024 // 처리 속도를 위해 긴 변이 이 크기를 넘으면 사진을 줄인다

// 기기에 맞는 설정 선택:
// - GPU(WebGPU) 지원 → 중간 크기 모델을 GPU로 (빠르고 품질 좋음)
// - 미지원 → 가장 작은 경량 모델을 CPU로 (다운로드·계산 모두 가벼움)
let config = navigator.gpu
  ? { model: 'isnet_fp16', device: 'gpu' }
  : { model: 'isnet_quint8', device: 'cpu' }

// 앱이 열리자마자 모델을 미리 내려받아 둔다 (사진 찍는 순간엔 준비 완료 상태)
export function warmup() {
  preload(config).catch(() => {}) // 실패해도 실제 처리 때 다시 시도되므로 무시
}

// 사진 파일 → 배경이 투명해진 PNG Blob
export async function removeBg(file) {
  const small = await downscale(file, MAX_DIM)
  try {
    return await removeBackground(small, config)
  } catch (err) {
    // GPU 초기화가 기기에 따라 실패할 수 있다 → CPU 경량 모델로 폴백
    if (config.device === 'gpu') {
      console.warn('GPU 누끼 실패, CPU로 재시도:', err)
      config = { model: 'isnet_quint8', device: 'cpu' }
      return removeBackground(small, config)
    }
    throw err
  }
}

// 사진이 크면 캔버스에 축소해서 다시 그린 뒤 JPEG로 반환
async function downscale(file, maxDim) {
  const img = await blobToImage(file)
  const scale = Math.min(maxDim / Math.max(img.naturalWidth, img.naturalHeight), 1)
  if (scale >= 1) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}
