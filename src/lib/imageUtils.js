// 이미지 로딩 공용 유틸

// Blob(파일 데이터)을 <img> 엘리먼트로 로드해서 반환
export function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url) // 로드가 끝났으니 임시 URL 정리
      resolve(img)
    }
    img.onerror = reject
    img.src = url
  })
}

// URL(SVG 에셋 등)을 <img> 엘리먼트로 로드해서 반환
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
