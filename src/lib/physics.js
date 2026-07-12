// matter.js 물리 세계: 중력 + 드래그 + 가로 스크롤(패닝) + 농구 골대.
// 사물 하나 = 물리 바디(충돌 계산용 사각형) 하나 = 화면의 <img> 하나.
// 월드는 화면보다 3배 넓다. 빈 곳을 끌면 카메라가 옆으로 움직이고(가로 스크롤),
// 사물 위에서 끌면 물리 드래그가 된다.
import Matter from 'matter-js'

const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Query } = Matter

const MAX_OBJECTS = 40 // 이보다 많아지면 오래된 것부터 제거 (물리 연산 부하 방지)
const WALL = 200 // 보이지 않는 벽 두께
const RIM_LEN = 190 // 골대 링 길이 = 사물이 통과할 수 있는 폭

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

export function createPlayground(container, { onGoal } = {}) {
  const W = Math.max(container.clientWidth * 3, 1500) // 월드 전체 너비

  // 사물·골대를 담는 레이어. 카메라 이동 = 이 레이어를 통째로 옆으로 밀기
  const worldEl = document.createElement('div')
  worldEl.className = 'world'
  worldEl.style.width = `${W}px`
  container.appendChild(worldEl)

  const engine = Engine.create()
  const items = [] // { body, el, w, h }
  let walls = []
  let cameraX = 0

  // 바닥은 선이 아니라 눈에 보이는 면(땅): 화면 높이의 2/3 지점부터 아래가 땅
  const floorY = Math.round(container.clientHeight * (2 / 3))
  const groundEl = document.createElement('div')
  groundEl.className = 'ground'
  groundEl.style.top = `${floorY}px`
  groundEl.style.width = `${W}px`
  groundEl.style.height = `${container.clientHeight - floorY + 100}px` // 화면이 커져도 틈이 없게 여유
  worldEl.appendChild(groundEl)

  // 바닥 + 월드 양 끝 벽. 화면 크기가 바뀌면 다시 만든다
  function rebuildWalls() {
    const h = container.clientHeight
    for (const wall of walls) Composite.remove(engine.world, wall)
    walls = [
      Bodies.rectangle(W / 2, floorY + WALL / 2, W + WALL * 2, WALL, { isStatic: true }),
      Bodies.rectangle(-WALL / 2, h / 2, WALL, h * 5, { isStatic: true }),
      Bodies.rectangle(W + WALL / 2, h / 2, WALL, h * 5, { isStatic: true }),
    ]
    Composite.add(engine.world, walls)
  }
  rebuildWalls()
  window.addEventListener('resize', rebuildWalls)

  // ── 농구 골대 (월드 오른쪽 끝) ──
  const rimY = Math.max(floorY - 230, 180) // 링 높이: 땅에서 230px 위
  const boardLeft = W - 34 // 백보드 왼쪽 면 x
  const tipX = boardLeft - RIM_LEN // 링 앞쪽 끝 x
  const sensor = Bodies.rectangle(tipX + RIM_LEN / 2, rimY + 26, RIM_LEN - 40, 6, {
    isStatic: true,
    isSensor: true, // 물리적으로는 그냥 통과되고 충돌 판정만 한다
  })
  Composite.add(engine.world, [
    Bodies.rectangle(boardLeft + 6, rimY - 55, 12, 190, { isStatic: true }), // 백보드
    Bodies.circle(tipX, rimY, 7, { isStatic: true }), // 링 앞끝 (여기 맞으면 튕겨나감)
    sensor,
  ])
  worldEl.insertAdjacentHTML('beforeend', hoopSvg(tipX, rimY, boardLeft))

  // 골 판정: 아래로 떨어지는 중인 사물이 링 안 센서에 닿으면 골인
  Events.on(engine, 'collisionStart', (e) => {
    for (const { bodyA, bodyB } of e.pairs) {
      const other = bodyA === sensor ? bodyB : bodyB === sensor ? bodyA : null
      if (!other || other.isStatic) continue
      if (other.velocity.y <= 1) continue // 아래로 떨어질 때만 (밑에서 위로 통과는 무시)
      const now = performance.now()
      if (now - (other.lastGoalAt || 0) < 1500) continue // 같은 사물 연속 판정 방지
      other.lastGoalAt = now
      if (onGoal) onGoal({ x: tipX + RIM_LEN / 2 - cameraX, y: rimY }) // 화면 좌표로 전달
    }
  })

  // ── 책상·의자 (월드 중간) — 사물을 의자에 앉히면 공부한다 ──
  const chairX = W * 0.45
  const seatY = floorY - 82 // 앉는 판 윗면 높이
  const deskX = chairX + 230
  const deskTopY = floorY - 150 // 책상 상판 윗면 높이
  Composite.add(engine.world, [
    Bodies.rectangle(chairX, seatY + 6, 150, 12, { isStatic: true }), // 앉는 판
    Bodies.rectangle(chairX - 78, seatY - 59, 12, 142, { isStatic: true }), // 등받이
    Bodies.rectangle(chairX - 58, (seatY + 12 + floorY) / 2, 10, floorY - seatY - 12, { isStatic: true }),
    Bodies.rectangle(chairX + 58, (seatY + 12 + floorY) / 2, 10, floorY - seatY - 12, { isStatic: true }),
    Bodies.rectangle(deskX, deskTopY + 7, 280, 14, { isStatic: true }), // 책상 상판
    Bodies.rectangle(deskX - 125, (deskTopY + 14 + floorY) / 2, 12, floorY - deskTopY - 14, { isStatic: true }),
    Bodies.rectangle(deskX + 125, (deskTopY + 14 + floorY) / 2, 12, floorY - deskTopY - 14, { isStatic: true }),
  ])
  worldEl.insertAdjacentHTML('beforeend', furnitureSvg(chairX, seatY, deskX, deskTopY, floorY))

  // "공부 중" 판정: 의자 위 영역에서 거의 멈춰 있는 사물 → 공부 이모지 발생
  const studyZone = { x1: chairX - 85, x2: chairX + 85, y1: seatY - 170, y2: seatY }
  const STUDY_EMOJIS = ['📖', '✏️', '💡', '🤓', '📚']
  const studyTimer = setInterval(() => {
    for (const { body, h } of items) {
      const { x, y } = body.position
      const sitting =
        x > studyZone.x1 && x < studyZone.x2 &&
        y > studyZone.y1 && y < studyZone.y2 &&
        body.speed < 1.5
      if (!sitting) continue
      const emoji = document.createElement('span')
      emoji.className = 'study-emoji'
      emoji.textContent = STUDY_EMOJIS[Math.floor(Math.random() * STUDY_EMOJIS.length)]
      emoji.style.left = `${x - 10 + (Math.random() - 0.5) * 40}px`
      emoji.style.top = `${y - h / 2 - 26}px`
      worldEl.appendChild(emoji)
      setTimeout(() => emoji.remove(), 1500) // 애니메이션 끝나면 정리
    }
  }, 650)

  // ── 트램펄린 (책상과 골대 사이) — 떨어진 사물을 위로 튕겨준다 ──
  const trampX = W * 0.72
  const trampY = floorY - 48 // 매트 윗면 높이
  const trampMat = Bodies.rectangle(trampX, trampY + 5, 180, 10, { isStatic: true })
  Composite.add(engine.world, trampMat)
  worldEl.insertAdjacentHTML('beforeend', trampolineSvg(trampX, trampY, floorY))

  // 아래로 떨어지다 매트에 닿은 사물만 위로 튕긴다 (낙하 속도에 비례, 최소 14 ~ 최대 26)
  Events.on(engine, 'collisionStart', (e) => {
    for (const { bodyA, bodyB } of e.pairs) {
      const other = bodyA === trampMat ? bodyB : bodyB === trampMat ? bodyA : null
      if (!other || other.isStatic) continue
      const vy = other.velocity.y
      if (vy <= 0) continue
      Body.setVelocity(other, { x: other.velocity.x, y: -Math.min(Math.max(vy * 1.1, 14), 26) })
    }
  })

  // 드래그 (마우스·터치 모두 지원)
  const mouse = Mouse.create(container)
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, damping: 0.1 },
  })
  Composite.add(engine.world, mouseConstraint)

  // 마우스를 놀이터 밖(버튼 위 등)에서 놓으면 container가 mouseup을 못 받아
  // 사물이 허공에 매달린 채 남는다 → window에서 한 번 더 놓아준다
  function releaseDrag() {
    mouse.button = -1
  }
  window.addEventListener('mouseup', releaseDrag)

  // ── 카메라(가로 스크롤) ──
  function setCamera(x) {
    cameraX = clamp(x, 0, W - container.clientWidth)
    worldEl.style.transform = `translate3d(${-cameraX}px, 0, 0)`
    Mouse.setOffset(mouse, { x: cameraX, y: 0 }) // 물리 좌표도 카메라만큼 보정
  }
  setCamera(0)

  // 빈 곳을 끌면 패닝, 사물 위에서 끌면 물리 드래그(Matter가 알아서)
  let pan = null
  function onPointerDown(e) {
    const worldPoint = { x: e.clientX + cameraX, y: e.clientY }
    const hit = Query.point(items.map((it) => it.body), worldPoint)
    if (hit.length === 0) pan = { id: e.pointerId, startX: e.clientX, startCam: cameraX }
  }
  function onPointerMove(e) {
    if (!pan || e.pointerId !== pan.id) return
    mouse.button = -1 // 패닝 중 카메라가 사물 위를 지나가도 드래그로 낚아채지 않게
    setCamera(pan.startCam - (e.clientX - pan.startX))
  }
  function onPointerEnd(e) {
    if (pan && e.pointerId === pan.id) pan = null
  }
  container.addEventListener('pointerdown', onPointerDown)
  container.addEventListener('pointermove', onPointerMove)
  container.addEventListener('pointerup', onPointerEnd)
  container.addEventListener('pointercancel', onPointerEnd)

  // 데스크톱에서는 휠(트랙패드)로도 가로 스크롤
  function onWheel(e) {
    e.preventDefault()
    setCamera(cameraX + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY))
  }
  container.addEventListener('wheel', onWheel, { passive: false })

  // 매 프레임 물리 위치 → DOM 반영
  function sync() {
    for (const { body, el, w, h } of items) {
      el.style.transform = `translate(${body.position.x - w / 2}px, ${body.position.y - h / 2}px) rotate(${body.angle}rad)`
    }
  }
  Events.on(engine, 'afterUpdate', sync)

  const runner = Runner.create()
  Runner.run(runner, engine)

  // 사물 추가: 지금 보이는 화면 위쪽 랜덤 위치에서 떨어뜨린다
  function addObject(imageUrl, w, h) {
    const el = document.createElement('img')
    el.src = imageUrl
    el.className = 'obj'
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    worldEl.appendChild(el)

    const x = cameraX + w / 2 + Math.random() * Math.max(container.clientWidth - w, 1)
    const body = Bodies.rectangle(x, -h, w, h, {
      restitution: 0.3, // 튀는 정도
      friction: 0.5,
    })
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2)
    Composite.add(engine.world, body)
    items.push({ body, el, w, h })

    while (items.length > MAX_OBJECTS) {
      const old = items.shift()
      Composite.remove(engine.world, old.body)
      URL.revokeObjectURL(old.el.src)
      old.el.remove()
    }
  }

  function destroy() {
    clearInterval(studyTimer)
    Runner.stop(runner)
    Events.off(engine)
    window.removeEventListener('resize', rebuildWalls)
    window.removeEventListener('mouseup', releaseDrag)
    container.removeEventListener('pointerdown', onPointerDown)
    container.removeEventListener('pointermove', onPointerMove)
    container.removeEventListener('pointerup', onPointerEnd)
    container.removeEventListener('pointercancel', onPointerEnd)
    container.removeEventListener('wheel', onWheel)
    // Matter가 container에 걸어둔 입력 리스너 해제
    container.removeEventListener('mousemove', mouse.mousemove)
    container.removeEventListener('mousedown', mouse.mousedown)
    container.removeEventListener('mouseup', mouse.mouseup)
    container.removeEventListener('wheel', mouse.mousewheel)
    container.removeEventListener('touchmove', mouse.touchmove)
    container.removeEventListener('touchstart', mouse.touchstart)
    container.removeEventListener('touchend', mouse.touchend)
    Composite.clear(engine.world, false)
    Engine.clear(engine)
    for (const { el } of items) URL.revokeObjectURL(el.src)
    items.length = 0
    worldEl.remove()
  }

  // 개발 중 디버깅·자동 테스트용
  if (import.meta.env.DEV) window.__pg = { Matter, engine, setCamera, studyZone, trampoline: { x: trampX, y: trampY } }

  return { addObject, destroy }
}

// 책상·의자 그림(SVG). 물리 바디와 같은 좌표를 쓰도록 여기서 함께 계산한다
function furnitureSvg(chairX, seatY, deskX, deskTopY, floorY) {
  const left = chairX - 110
  const top = floorY - 310
  const X = (wx) => (wx - left).toFixed(1)
  const Y = (wy) => (wy - top).toFixed(1)
  return `
    <svg class="furniture" width="${Math.ceil(deskX + 160 - left)}" height="${Math.ceil(floorY - top)}" style="left:${left}px;top:${top}px">
      <!-- 의자: 등받이·앉는 판·다리 -->
      <rect class="frame" x="${X(chairX - 84)}" y="${Y(seatY - 130)}" width="12" height="142" rx="4"/>
      <rect class="frame" x="${X(chairX - 75)}" y="${Y(seatY)}" width="150" height="12" rx="4"/>
      <rect class="frame" x="${X(chairX - 63)}" y="${Y(seatY + 12)}" width="10" height="${(floorY - seatY - 12).toFixed(1)}"/>
      <rect class="frame" x="${X(chairX + 53)}" y="${Y(seatY + 12)}" width="10" height="${(floorY - seatY - 12).toFixed(1)}"/>
      <!-- 책상: 상판·다리 -->
      <rect class="frame" x="${X(deskX - 140)}" y="${Y(deskTopY)}" width="280" height="14" rx="4"/>
      <rect class="frame" x="${X(deskX - 131)}" y="${Y(deskTopY + 14)}" width="12" height="${(floorY - deskTopY - 14).toFixed(1)}"/>
      <rect class="frame" x="${X(deskX + 119)}" y="${Y(deskTopY + 14)}" width="12" height="${(floorY - deskTopY - 14).toFixed(1)}"/>
      <!-- 펼친 책 -->
      <path class="book" d="M${X(deskX - 95)} ${Y(deskTopY)} q 25 -16 50 -2 q 25 -14 50 2 l -50 6 z"/>
      <!-- 스탠드 조명: 불빛·기둥·갓 -->
      <circle class="lamp-glow" cx="${X(deskX + 95)}" cy="${Y(deskTopY - 50)}" r="42"/>
      <rect class="lamp-stem" x="${X(deskX + 92)}" y="${Y(deskTopY - 64)}" width="6" height="64"/>
      <path class="lamp-shade" d="M${X(deskX + 73)} ${Y(deskTopY - 64)} L${X(deskX + 117)} ${Y(deskTopY - 64)} L${X(deskX + 105)} ${Y(deskTopY - 87)} L${X(deskX + 85)} ${Y(deskTopY - 87)} z"/>
      <circle class="lamp-bulb" cx="${X(deskX + 95)}" cy="${Y(deskTopY - 60)}" r="5"/>
    </svg>`
}

// 트램펄린 그림(SVG). 물리 바디와 같은 좌표를 쓰도록 여기서 함께 계산한다
function trampolineSvg(trampX, trampY, floorY) {
  const left = trampX - 110
  const top = trampY - 16
  const X = (wx) => (wx - left).toFixed(1)
  const Y = (wy) => (wy - top).toFixed(1)
  return `
    <svg class="trampoline" width="220" height="${Math.ceil(floorY - top)}" style="left:${left}px;top:${top}px">
      <!-- 매트 -->
      <rect class="tramp-mat" x="${X(trampX - 90)}" y="${Y(trampY)}" width="180" height="9" rx="4.5"/>
      <!-- 스프링 (지그재그) -->
      <path class="tramp-spring" d="M${X(trampX - 84)} ${Y(trampY + 9)} l 5 7 l -8 5 l 8 5" fill="none"/>
      <path class="tramp-spring" d="M${X(trampX + 84)} ${Y(trampY + 9)} l -5 7 l 8 5 l -8 5" fill="none"/>
      <!-- 다리 (A자) -->
      <path class="tramp-leg" d="M${X(trampX - 82)} ${Y(trampY + 26)} L${X(trampX - 58)} ${Y(floorY)}" fill="none"/>
      <path class="tramp-leg" d="M${X(trampX + 82)} ${Y(trampY + 26)} L${X(trampX + 58)} ${Y(floorY)}" fill="none"/>
    </svg>`
}

// 골대 그림(SVG). 물리 바디와 같은 좌표를 쓰도록 여기서 함께 계산한다
function hoopSvg(tipX, rimY, boardLeft) {
  const left = tipX - 20
  const top = rimY - 175
  const rx = tipX - left // SVG 좌표계의 링 앞끝
  const ry = rimY - top
  const bx = boardLeft - left // SVG 좌표계의 백보드
  const netBottom = ry + 72
  // 그물: 링 위 5개 지점에서 아래로 모이는 선들
  const tops = [0.12, 0.31, 0.5, 0.69, 0.88].map((t) => (rx + (bx - rx) * t).toFixed(1))
  const bots = [0.28, 0.39, 0.5, 0.61, 0.72].map((t) => (rx + (bx - rx) * t).toFixed(1))
  const netLines = tops.map((x, i) => `M${x} ${ry} L${bots[i]} ${netBottom}`).join(' ')
  const crossY1 = ry + 26
  const crossY2 = ry + 50
  return `
    <svg class="hoop" width="${bx + 16}" height="${ry + 90}" style="left:${left}px;top:${top}px">
      <rect class="board" x="${bx}" y="${ry - 150}" width="12" height="190" rx="3"/>
      <path class="net" d="${netLines}
        M${bots[0]} ${crossY1} L${bots[4]} ${crossY1}
        M${bots[0]} ${crossY2} L${bots[4]} ${crossY2}"/>
      <line class="rim" x1="${rx}" y1="${ry}" x2="${bx}" y2="${ry}"/>
      <circle class="rim-tip" cx="${rx}" cy="${ry}" r="7"/>
    </svg>`
}
