# 사물 놀이터 (soma 랜딩 로컬 데모)

사진을 찍으면 → 누끼(배경 제거) → 카툰 팔다리 합성 → 중력이 있는 놀이터에 떨어지는 웹 데모.
전체 계획은 옵시디언 `soma/계획.md` 참고. 현재는 1~4단계(로컬 데모)까지 구현된 상태.

## 실행

```bash
npm install   # 처음 한 번만
npm run dev
```

- 터미널에 뜨는 `Local:` 주소를 브라우저에서 열기.
- 같은 와이파이의 폰에서 보려면 `Network:` 주소를 폰 브라우저에 입력.
- 첫 사진 처리 때는 AI 모델(약 40~80MB)을 내려받아서 오래 걸림. 두 번째부터는 빠름.

## 구조

```
src/
  App.jsx            화면(버튼·스피너)과 전체 흐름
  lib/
    removeBg.js      누끼 모듈 (preload + GPU/CPU 자동 선택) — 2차(탭 선택)에서 이 파일만 교체
    limbs.js         팔다리 합성 (바운딩 박스 찾기 → 랜덤 팔다리 → PNG 한 장)
    physics.js       matter.js 중력 세계 (드래그·가로 패닝·농구 골대·골 판정)
    store.js         Supabase 공유 (업로드·목록·실시간 구독)
    imageUtils.js    이미지 로딩 유틸
  assets/limbs/      임시 팔다리 SVG — 진짜 에셋이 생기면 파일만 교체
supabase/
  migrations/        DB 설정 (테이블·권한·실시간·버킷·청소 크론)
  functions/cleanup/ 오래된 사물 삭제 함수 (매일 새벽 3시 KST 자동 실행, 보관 7일)
```

## 공유 모드 설정

`.env.local`에 Supabase 값이 있으면 모두의 사물이 공유되고, 없으면 로컬 전용 모드로 돈다.
Supabase 프로젝트: `soma-landing` (서울 리전). 키는 `.env.example` 참고, 실제 값은 `.env.local`.
배포 시에는 같은 값을 Netlify 환경변수로 넣어야 한다.

## 다음 단계 (soma/계획.md)

7. Netlify 배포
