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

  // 바닥 + 월드 양 끝 벽. 화면 크기가 바뀌면 다시 만든다
  function rebuildWalls() {
    const h = container.clientHeight
    for (const wall of walls) Composite.remove(engine.world, wall)
    walls = [
      Bodies.rectangle(W / 2, h + WALL / 2, W + WALL * 2, WALL, { isStatic: true }),
      Bodies.rectangle(-WALL / 2, h / 2, WALL, h * 5, { isStatic: true }),
      Bodies.rectangle(W + WALL / 2, h / 2, WALL, h * 5, { isStatic: true }),
    ]
    Composite.add(engine.world, walls)
  }
  rebuildWalls()
  window.addEventListener('resize', rebuildWalls)

  // ── 농구 골대 (월드 오른쪽 끝) ──
  const rimY = Math.max(container.clientHeight * 0.42, 220) // 링 높이
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
  if (import.meta.env.DEV) window.__pg = { Matter, engine, setCamera }

  return { addObject, destroy }
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
