// matter.js 물리 세계: 중력 + 드래그 + 가로 스크롤(패닝) + 농구 골대.
// 사물 하나 = 물리 바디(충돌 계산용 사각형) 하나 = 화면의 <img> 하나.
// 월드는 화면보다 3배 넓다. 빈 곳을 끌면 카메라가 옆으로 움직이고(가로 스크롤),
// 사물 위에서 끌면 물리 드래그가 된다.
import Matter from 'matter-js'
import { createObjectEl, POSES } from './objectView'

const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Query } = Matter

const MAX_OBJECTS = 40 // 이보다 많아지면 오래된 것부터 제거 (물리 연산 부하 방지)
const WALL = 200 // 보이지 않는 벽 두께
const RIM_LEN = 175 // 골대 링 길이 = 사물이 통과할 수 있는 폭

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

  // 바닥은 눈에 보이는 "면": 화면 2/3 지점(뒷벽과 땅의 경계)부터 아래 전체가 땅.
  // 사물은 화면 맨 아래(땅의 앞쪽 끝)까지 떨어지고,
  // 가구들은 땅 위 여기저기(서로 다른 깊이)에 흩어져 선다.
  const wallY = Math.round(container.clientHeight * (2 / 3))
  const band = Math.round(container.clientHeight * 0.96) - wallY
  const furnitureBaseY = Math.round(wallY + band * 0.35) // 책상·의자가 서는 곳: 뒤쪽
  const trampBaseY = Math.round(wallY + band * 0.7) // 트램펄린이 서는 곳: 중간

  const groundEl = document.createElement('div')
  groundEl.className = 'ground'
  groundEl.style.top = `${wallY}px`
  groundEl.style.width = `${W}px`
  groundEl.style.height = `${container.clientHeight - wallY + 100}px` // 화면이 커져도 틈이 없게 여유
  worldEl.appendChild(groundEl)

  // 방 장식: 벽의 액자·창문, 바닥의 러그, 화분
  worldEl.insertAdjacentHTML('beforeend', decorSvg(W, container.clientHeight, wallY, band))

  // 바닥(화면 맨 아래) + 월드 양 끝 벽. 화면 크기가 바뀌면 다시 만든다
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

  // ── 농구 골대 (뒷벽, 창문 옆) — 링이 화면 쪽으로 튀어나온 정면 골대 ──
  // 백보드는 뒷벽에 그림으로만 있고(몸체 없음), 링 양쪽 테에만 충돌이 있다
  const rimY = Math.max(wallY - 60, 160) // 링 높이
  const ringCX = W - 130 // 링 중심 x
  const sensor = Bodies.rectangle(ringCX, rimY + 22, RIM_LEN - 40, 6, {
    isStatic: true,
    isSensor: true, // 물리적으로는 그냥 통과되고 충돌 판정만 한다
  })
  Composite.add(engine.world, [
    Bodies.circle(ringCX - RIM_LEN / 2, rimY, 6, { isStatic: true }), // 링 왼쪽 테
    Bodies.circle(ringCX + RIM_LEN / 2, rimY, 6, { isStatic: true }), // 링 오른쪽 테
    sensor,
  ])
  worldEl.insertAdjacentHTML('beforeend', hoopSvg(ringCX, rimY))

  // 골 판정: 아래로 떨어지는 중인 사물이 링 안 센서에 닿으면 골인
  Events.on(engine, 'collisionStart', (e) => {
    for (const { bodyA, bodyB } of e.pairs) {
      const other = bodyA === sensor ? bodyB : bodyB === sensor ? bodyA : null
      if (!other || other.isStatic) continue
      if (other.velocity.y <= 1) continue // 아래로 떨어질 때만 (밑에서 위로 통과는 무시)
      const now = performance.now()
      if (now - (other.lastGoalAt || 0) < 1500) continue // 같은 사물 연속 판정 방지
      other.lastGoalAt = now
      if (onGoal) onGoal({ x: ringCX - cameraX, y: rimY }) // 화면 좌표로 전달
    }
  })

  // ── 책상·의자 (월드 중간, 땅의 뒤쪽에 서 있음) — 사물을 의자에 앉히면 공부한다 ──
  const chairX = W * 0.45
  const seatY = furnitureBaseY - 50 // 앉는 판 윗면 높이
  const deskX = chairX + 150
  const deskTopY = furnitureBaseY - 92 // 책상 상판 윗면 높이
  Composite.add(engine.world, [
    Bodies.rectangle(chairX, seatY + 4, 100, 8, { isStatic: true }), // 앉는 판
    Bodies.rectangle(chairX - 52, seatY - 37, 8, 90, { isStatic: true }), // 등받이
    Bodies.rectangle(chairX - 38, (seatY + 8 + furnitureBaseY) / 2, 7, furnitureBaseY - seatY - 8, { isStatic: true }),
    Bodies.rectangle(chairX + 38, (seatY + 8 + furnitureBaseY) / 2, 7, furnitureBaseY - seatY - 8, { isStatic: true }),
    Bodies.rectangle(deskX, deskTopY + 5, 170, 10, { isStatic: true }), // 책상 상판
    Bodies.rectangle(deskX - 76, (deskTopY + 10 + furnitureBaseY) / 2, 8, furnitureBaseY - deskTopY - 10, { isStatic: true }),
    Bodies.rectangle(deskX + 76, (deskTopY + 10 + furnitureBaseY) / 2, 8, furnitureBaseY - deskTopY - 10, { isStatic: true }),
  ])
  worldEl.insertAdjacentHTML('beforeend', furnitureSvg(chairX, seatY, deskX, deskTopY, furnitureBaseY))

  // "공부 중": 의자 위에서 거의 멈춘 사물 하나를 의자 가운데에 챡 앉힌다.
  // 팔다리는 이미지에 구워져 있어 실제로 접을 수는 없으므로,
  // 자세 스냅 + 책상 쪽 기울임(시각 효과) + 손 위치의 연필로 공부하는 느낌을 낸다.
  const studyZone = { x1: chairX - 60, x2: chairX + 60, y1: seatY - 160, y2: seatY }
  let student = null // { item, pencil } — 공부 중인 사물은 한 번에 하나

  function isSitting(body) {
    const { x, y } = body.position
    return (
      x > studyZone.x1 && x < studyZone.x2 &&
      y > studyZone.y1 && y < studyZone.y2 &&
      body.speed < 1.5
    )
  }

  function beginStudy(item) {
    const { body, w, h } = item
    Body.setPosition(body, { x: chairX, y: seatY - h / 2 }) // 의자 가운데에 챡
    Body.setVelocity(body, { x: 0, y: 0 })
    Body.setAngularVelocity(body, 0)
    Body.setAngle(body, 0)
    item.lean = 0.08 // 책상 쪽으로 살짝 기울인 집중 자세 (그림에만 적용, 물리는 그대로)
    item.setPose(POSES.study) // 다리를 앞으로, 팔을 책상 위로
    const pencil = document.createElement('div')
    pencil.className = 'pencil'
    pencil.innerHTML = pencilSvg()
    pencil.style.left = `${chairX + w * 0.42 - 12}px` // 오른손 끝 근처
    pencil.style.top = `${seatY - h * 0.52 - 22}px`
    worldEl.appendChild(pencil)
    student = { item, pencil }
  }

  const studyTimer = setInterval(() => {
    // 공부하던 사물이 의자를 떠났으면(또는 정리됐으면) 연필을 거둔다
    if (student && (!items.includes(student.item) || !isSitting(student.item.body))) {
      student.item.lean = 0
      student.item.setPose(POSES.idle)
      student.pencil.remove()
      student = null
    }
    if (student) return
    const next = items.find((it) => isSitting(it.body))
    if (next) beginStudy(next)
  }, 450)

  // ── 트램펄린 (책상과 골대 사이, 땅의 중간 깊이에 서 있음) — 떨어진 사물을 위로 튕겨준다 ──
  const trampX = W * 0.72
  const trampY = trampBaseY - 32 // 매트 윗면 높이
  const trampMat = Bodies.rectangle(trampX, trampY + 4, 120, 8, { isStatic: true })
  Composite.add(engine.world, trampMat)
  worldEl.insertAdjacentHTML('beforeend', trampolineSvg(trampX, trampY, trampBaseY))

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

  // 매 프레임 물리 위치 → DOM 반영 (lean: 공부 자세용 시각적 기울임)
  function sync() {
    for (const { body, el, w, h, lean } of items) {
      el.style.transform = `translate(${body.position.x - w / 2}px, ${body.position.y - h / 2}px) rotate(${body.angle + (lean || 0)}rad)`
    }
  }
  Events.on(engine, 'afterUpdate', sync)

  const runner = Runner.create()
  Runner.run(runner, engine)

  // 사물 추가: 지금 보이는 화면 위쪽 랜덤 위치에서 떨어뜨린다 (화면 맨 아래까지)
  // spec: { url(몸 이미지), w, h, limbs(팔다리 부품 데이터, 옛 데이터는 null) }
  // 물리 충돌 상자는 팔다리를 포함한 전체 크기(extW×extH)로 잡는다 → 발이 바닥에 닿는다
  function addObject(spec) {
    const { url } = spec
    const { el, setPose, extW, extH } = createObjectEl(spec)
    worldEl.appendChild(el)

    const x = cameraX + extW / 2 + Math.random() * Math.max(container.clientWidth - extW, 1)
    const body = Bodies.rectangle(x, -extH, extW, extH, {
      restitution: 0.3, // 튀는 정도
      friction: 0.5,
    })
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2)
    Composite.add(engine.world, body)
    items.push({ body, el, w: extW, h: extH, url, setPose })

    while (items.length > MAX_OBJECTS) {
      const old = items.shift()
      Composite.remove(engine.world, old.body)
      URL.revokeObjectURL(old.url)
      old.el.remove()
    }
  }

  function destroy() {
    clearInterval(studyTimer)
    if (student) student.pencil.remove()
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
    for (const { url } of items) URL.revokeObjectURL(url)
    items.length = 0
    worldEl.remove()
  }

  // 개발 중 디버깅·자동 테스트용
  if (import.meta.env.DEV) window.__pg = { Matter, engine, setCamera, studyZone, trampoline: { x: trampX, y: trampY } }

  return { addObject, destroy }
}

// 책상·의자 그림(SVG). 물리 바디와 같은 좌표를 쓰도록 여기서 함께 계산한다
function furnitureSvg(chairX, seatY, deskX, deskTopY, floorY) {
  const left = chairX - 70
  const top = floorY - 200
  const X = (wx) => (wx - left).toFixed(1)
  const Y = (wy) => (wy - top).toFixed(1)
  return `
    <svg class="furniture" width="${Math.ceil(deskX + 110 - left)}" height="${Math.ceil(floorY - top)}" style="left:${left}px;top:${top}px">
      <!-- 의자: 등받이·앉는 판·다리 -->
      <rect class="frame" x="${X(chairX - 56)}" y="${Y(seatY - 82)}" width="8" height="90" rx="3"/>
      <rect class="frame" x="${X(chairX - 50)}" y="${Y(seatY)}" width="100" height="8" rx="3"/>
      <rect class="frame" x="${X(chairX - 41)}" y="${Y(seatY + 8)}" width="7" height="${(floorY - seatY - 8).toFixed(1)}"/>
      <rect class="frame" x="${X(chairX + 34)}" y="${Y(seatY + 8)}" width="7" height="${(floorY - seatY - 8).toFixed(1)}"/>
      <!-- 의자 앉는 판 윗면 (내려다보는 각도) -->
      <path class="top" d="M${X(chairX - 50)} ${Y(seatY)} l 14 -9 l 100 0 l -14 9 z"/>
      <!-- 책상: 상판(옆면+윗면)·다리 -->
      <rect class="frame" x="${X(deskX - 85)}" y="${Y(deskTopY)}" width="170" height="10" rx="3"/>
      <path class="top" d="M${X(deskX - 85)} ${Y(deskTopY)} l 18 -12 l 170 0 l -18 12 z"/>
      <rect class="frame" x="${X(deskX - 80)}" y="${Y(deskTopY + 10)}" width="8" height="${(floorY - deskTopY - 10).toFixed(1)}"/>
      <rect class="frame" x="${X(deskX + 72)}" y="${Y(deskTopY + 10)}" width="8" height="${(floorY - deskTopY - 10).toFixed(1)}"/>
      <!-- 펼친 책 -->
      <path class="book" d="M${X(deskX - 58)} ${Y(deskTopY)} q 16 -10 32 -1 q 16 -9 32 1 l -32 4 z"/>
      <!-- 스탠드 조명: 불빛·기둥·갓 -->
      <circle class="lamp-glow" cx="${X(deskX + 52)}" cy="${Y(deskTopY - 30)}" r="27"/>
      <rect class="lamp-stem" x="${X(deskX + 50)}" y="${Y(deskTopY - 40)}" width="4" height="40"/>
      <path class="lamp-shade" d="M${X(deskX + 38)} ${Y(deskTopY - 40)} L${X(deskX + 66)} ${Y(deskTopY - 40)} L${X(deskX + 59)} ${Y(deskTopY - 55)} L${X(deskX + 45)} ${Y(deskTopY - 55)} z"/>
      <circle class="lamp-bulb" cx="${X(deskX + 52)}" cy="${Y(deskTopY - 37)}" r="3.5"/>
    </svg>`
}

// 방 장식 그림(SVG): 벽 액자·창문(달), 바닥 러그, 화분
function decorSvg(W, H, wallY, band) {
  const frameY = Math.max(wallY - 210, 40)
  const f1 = W * 0.16
  const f2 = W * 0.52
  const winX = W * 0.72 // 창문 (골대가 그 오른쪽 벽에 걸린다)
  const rugX = W * 0.2
  const rugY = wallY + band * 0.55
  const plantX = W * 0.38
  const plantBase = wallY + band * 0.35
  return `
    <svg class="decor" width="${W}" height="${H}" style="left:0;top:0">
      <!-- 벽 액자 -->
      <g class="frame" transform="translate(${f1} ${frameY})">
        <rect x="0" y="0" width="90" height="66" rx="6"/>
        <path class="art" d="M14 48 L34 26 L48 40 L62 22 L76 48"/>
      </g>
      <g class="frame" transform="translate(${f2} ${frameY - 14})">
        <rect x="0" y="0" width="66" height="80" rx="6"/>
        <circle class="art" cx="33" cy="40" r="18"/>
      </g>
      <!-- 창문 (달이 보이는) -->
      <g class="window" transform="translate(${winX} ${frameY - 20})">
        <rect x="0" y="0" width="110" height="130" rx="8"/>
        <line x1="55" y1="4" x2="55" y2="126"/>
        <line x1="4" y1="65" x2="106" y2="65"/>
        <circle class="moon" cx="80" cy="34" r="13"/>
      </g>
      <!-- 바닥 러그 -->
      <ellipse class="rug" cx="${rugX}" cy="${rugY}" rx="140" ry="30"/>
      <ellipse class="rug-inner" cx="${rugX}" cy="${rugY}" rx="95" ry="19"/>
      <!-- 화분 -->
      <g class="plant" transform="translate(${plantX} ${plantBase})">
        <ellipse class="leaf" cx="0" cy="-46" rx="8" ry="22"/>
        <ellipse class="leaf" cx="-14" cy="-38" rx="8" ry="20" transform="rotate(-28 -14 -38)"/>
        <ellipse class="leaf" cx="14" cy="-38" rx="8" ry="20" transform="rotate(28 14 -38)"/>
        <path class="pot" d="M-11 0 L11 0 L15 -22 L-15 -22 Z"/>
      </g>
    </svg>`
}

// 공부하는 사물이 손에 쥐는 연필 그림
function pencilSvg() {
  return `
    <svg width="44" height="44" viewBox="0 0 44 44">
      <g transform="rotate(40 22 22)">
        <rect x="4" y="19" width="26" height="7" rx="1.5" fill="#f5b301"/>
        <polygon points="30 19, 38 22.5, 30 26" fill="#e8c9a0"/>
        <polygon points="35.4 20.6, 38 22.5, 35.4 24.4" fill="#333"/>
        <rect x="1" y="19" width="5" height="7" rx="2" fill="#ef6b81"/>
      </g>
    </svg>`
}

// 트램펄린 그림(SVG). 물리 바디와 같은 좌표를 쓰도록 여기서 함께 계산한다
function trampolineSvg(trampX, trampY, floorY) {
  const left = trampX - 75
  const top = trampY - 12
  const X = (wx) => (wx - left).toFixed(1)
  const Y = (wy) => (wy - top).toFixed(1)
  return `
    <svg class="trampoline" width="150" height="${Math.ceil(floorY - top)}" style="left:${left}px;top:${top}px">
      <!-- 매트: 위에서 본 원(타원) -->
      <ellipse class="tramp-mat-edge" cx="${X(trampX)}" cy="${Y(trampY + 7)}" rx="60" ry="10"/>
      <ellipse class="tramp-mat" cx="${X(trampX)}" cy="${Y(trampY + 2)}" rx="60" ry="10"/>
      <!-- 스프링 (지그재그) -->
      <path class="tramp-spring" d="M${X(trampX - 56)} ${Y(trampY + 7)} l 4 5 l -6 4 l 6 4" fill="none"/>
      <path class="tramp-spring" d="M${X(trampX + 56)} ${Y(trampY + 7)} l -4 5 l 6 4 l -6 4" fill="none"/>
      <!-- 다리 (A자) -->
      <path class="tramp-leg" d="M${X(trampX - 54)} ${Y(trampY + 18)} L${X(trampX - 38)} ${Y(floorY)}" fill="none"/>
      <path class="tramp-leg" d="M${X(trampX + 54)} ${Y(trampY + 18)} L${X(trampX + 38)} ${Y(floorY)}" fill="none"/>
    </svg>`
}

// 골대 그림(SVG). 물리 바디와 같은 좌표를 쓰도록 여기서 함께 계산한다
function hoopSvg(cx, rimY) {
  const rx = RIM_LEN / 2
  const bw = 120 // 백보드 폭
  const bh = 90 // 백보드 높이
  const left = cx - rx - 24
  const top = rimY - bh - 40
  const X = (wx) => (wx - left).toFixed(1)
  const Y = (wy) => (wy - top).toFixed(1)
  const netTop = rimY + 8
  const netBottom = rimY + 56
  // 그물: 링 타원 아래에서 좁아지며 내려오는 선들
  const tops = [-0.8, -0.4, 0, 0.4, 0.8].map((t) => X(cx + rx * t))
  const bots = [-0.45, -0.22, 0, 0.22, 0.45].map((t) => X(cx + rx * t))
  const netLines = tops.map((x, i) => `M${x} ${Y(netTop)} L${bots[i]} ${Y(netBottom)}`).join(' ')
  return `
    <svg class="hoop" width="${Math.ceil(rx * 2 + 48)}" height="${Math.ceil(netBottom + 10 - top)}" style="left:${left}px;top:${top}px">
      <rect class="board" x="${X(cx - bw / 2)}" y="${Y(rimY - bh - 24)}" width="${bw}" height="${bh}" rx="8"/>
      <rect class="board-inner" x="${X(cx - 26)}" y="${Y(rimY - 66)}" width="52" height="38" rx="4"/>
      <line class="mount" x1="${X(cx)}" y1="${Y(rimY - 24)}" x2="${X(cx)}" y2="${Y(rimY - 4)}"/>
      <path class="net" d="${netLines}
        M${bots[0]} ${Y(rimY + 24)} L${bots[4]} ${Y(rimY + 24)}
        M${bots[0]} ${Y(rimY + 40)} L${bots[4]} ${Y(rimY + 40)}"/>
      <ellipse class="rim" cx="${X(cx)}" cy="${Y(rimY)}" rx="${rx}" ry="12"/>
    </svg>`
}
