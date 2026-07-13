import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { createPlayground } from './lib/physics'
import { removeBg, warmup } from './lib/removeBg'
import { generateLimbs } from './lib/limbs'
import { loadImage } from './lib/imageUtils'
import { isShared, uploadObject, listRecent, onNewObject } from './lib/store'
import { computeExtents } from './lib/objectView'
import './App.css'

// 모든 사물의 전체 크기(팔다리 포함) — 사진이 크든 작든 전부 이 크기로 통일
const OBJECT_SIZE = 150

export default function App() {
  const groundRef = useRef(null)
  const worldRef = useRef(null)
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  // 팔다리 포함 전체 크기가 OBJECT_SIZE가 되도록 몸 크기를 정한다
  function sizedSpec(url, naturalW, naturalH, limbs) {
    const { extW, extH } = computeExtents(naturalW, naturalH, limbs)
    const k = OBJECT_SIZE / Math.max(extW, extH)
    return { url, w: Math.round(naturalW * k), h: Math.round(naturalH * k), limbs }
  }

  // 이미지 URL의 원본 크기를 재서 월드에 떨어뜨린다
  async function dropFromUrl({ url, limbs }) {
    const img = await loadImage(url)
    worldRef.current.addObject(sizedSpec(url, img.naturalWidth, img.naturalHeight, limbs))
  }

  // 물리 세계는 처음 한 번만 만들고, 화면이 사라질 때 정리한다
  useEffect(() => {
    warmup() // 누끼 AI 모델을 미리 내려받아 첫 사진 처리를 앞당긴다
    const world = createPlayground(groundRef.current, {
      // 골인! 링 위치에서 작은 콘페티
      onGoal: ({ x, y }) =>
        confetti({
          particleCount: 50,
          spread: 65,
          startVelocity: 25,
          scalar: 0.8,
          origin: { x: x / window.innerWidth, y: y / window.innerHeight },
        }),
    })
    worldRef.current = world

    // 공유 모드: 쌓여 있던 사물들을 차례로 떨어뜨리고, 새 사물을 실시간 구독
    let cancelled = false
    let unsubscribe = null
    if (isShared) {
      listRecent()
        .then(async (objects) => {
          for (const object of objects) {
            if (cancelled) return
            await dropFromUrl(object)
            await new Promise((resolve) => setTimeout(resolve, 180))
          }
        })
        .catch(console.error)
      unsubscribe = onNewObject((object) => dropFromUrl(object).catch(console.error))
    }

    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
      world.destroy()
    }
  }, [])

  async function onPick(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = '' // 같은 사진을 다시 골라도 change 이벤트가 오도록 초기화
    if (!file || busy) return
    setBusy(true)
    try {
      const cutout = await removeBg(file)
      const { bodyBlob, width, height, limbs } = await generateLimbs(cutout)
      // 내 화면에는 즉시 떨어뜨리고
      worldRef.current.addObject(sizedSpec(URL.createObjectURL(bodyBlob), width, height, limbs))
      // 공유 모드면 업로드해서 다른 사람들 화면에도 떨어지게 한다
      if (isShared) await uploadObject(bodyBlob, limbs)
    } catch (err) {
      console.error(err)
      setError(true)
      setTimeout(() => setError(false), 2000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="playground" ref={groundRef} />
      <button
        className="shoot"
        onClick={() => inputRef.current.click()}
        disabled={busy}
        aria-label="사진 찍기"
      >
        {busy ? <span className="spinner" /> : error ? '⚠️' : '📷'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onPick}
      />
    </>
  )
}
