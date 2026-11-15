import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import os from 'node:os'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { PARTS, PART_IDS, PLATFORM_IDS, SOLDER, WIRES } from '../src/config.ts'

const url = process.env.TEST_URL || 'http://127.0.0.1:4408/'
const out = process.env.TEST_OUTPUT || join(os.tmpdir(), 'volta-qa')
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-angle=d3d11', '--disable-dev-shm-usage'] })
const report = { browser: await browser.version(), url, checks: [], errors: [], screenshots: [] }
const check = (name, value) => { assert(value, name); report.checks.push(name); console.log('PASS', name) }
const wait = ms => new Promise(r => setTimeout(r, ms))
const read = p => p.evaluate(() => window.__VOLTA__.read())
const snap = async (p, name) => { await p.screenshot({ path: `${out}/${name}.png` }); report.screenshots.push(name) }
const onCanvas = (p, point) => p.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', point)
async function hitMarker(p, selector, touch = false) {
  const el = p.locator(selector)
  await el.waitFor({ state: 'visible', timeout: 30000 })
  for (let i = 0; i < 60; i++) {
    const box = await el.boundingBox()
    if (box) {
      const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2)
      if (await p.evaluate(([x, y, selector]) => document.elementFromPoint(x, y)?.closest(selector) !== null, [x, y, selector])) {
        if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y)
        await wait(140); return true
      }
    }
    await wait(120)
  }
  return false
}

async function pixelDifference(a, b, corners) {
  const first = PNG.sync.read(await readFile(`${out}/${a}.png`)), second = PNG.sync.read(await readFile(`${out}/${b}.png`))
  let pixels = 0, difference = 0, lumaA = 0, lumaB = 0
  const inside = (x, y) => { let hit = false; for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) { const p1 = corners[i], p2 = corners[j]; if (((p1.y > y) !== (p2.y > y)) && (x < (p2.x - p1.x) * (y - p1.y) / (p2.y - p1.y) + p1.x)) hit = !hit } return hit }
  for (let y = 0; y < first.height; y += 2) for (let x = 0; x < first.width; x += 2) {
    if (!inside(x, y)) continue
    pixels++
    const i = (y * first.width + x) * 4
    for (let c = 0; c < 3; c++) difference += Math.abs(first.data[i + c] - second.data[i + c]) / 3
    lumaA += .2126 * first.data[i] + .7152 * first.data[i + 1] + .0722 * first.data[i + 2]
    lumaB += .2126 * second.data[i] + .7152 * second.data[i + 1] + .0722 * second.data[i + 2]
  }
  assert(pixels > 400, 'the monitor must cover a real region of the frame')
  return { pixels, difference: difference / pixels, lumaA: lumaA / pixels, lumaB: lumaB / pixels }
}
async function settle(p) {
  let previous = (await read(p)).camera.position
  for (let i = 0; i < 250; i++) {
    await wait(100)
    const now = await read(p)
    const placed = now.state.card === 'bench' && PART_IDS.every(id => Math.hypot(...now.parts[id].world.map((v, j) => v - (now.state.installed.includes(id) ? PARTS[id].slot : PARTS[id].home)[j])) < .04)
    const still = Math.hypot(...now.camera.position.map((v, j) => v - previous[j])) < .006
    if ((placed || now.state.card !== 'bench') && still && now.state.phase === 'assembly' && !now.state.seating) return
    previous = now.camera.position
  }
  throw Error('Scene did not settle')
}
async function select(p, id, touch = false) {
  if ((await read(p)).state.mode !== 'parts') await p.getByTestId('parts-mode')[touch ? 'tap' : 'click']()
  if ((await read(p)).state.selected !== id) await p.getByTestId(`part-${id}`)[touch ? 'tap' : 'click']()
  assert.equal((await read(p)).state.selected, id)
}
async function orient(p, id, touch = false) {
  await select(p, id, touch)
  for (let i = 0; i < 4; i++) {
    const angle = (await read(p)).state.angles[id]
    if (Math.min(Math.abs(angle % (Math.PI * 2)), Math.abs((angle % (Math.PI * 2)) - Math.PI * 2)) < .1) return
    await p.getByTestId('rotate')[touch ? 'tap' : 'click']()
  }
  assert.fail(`could not orient ${id}`)
}
async function place(p, id, touch = false) {
  await settle(p); await select(p, id, touch)
  const d = await read(p)
  if (!touch && await onCanvas(p, d.parts[id].screen)) {
    await p.mouse.move(d.parts[id].screen.x, d.parts[id].screen.y); await p.mouse.down(); await wait(90)
    if ((await read(p)).drag?.id === id) {
      check(`camera locked while dragging ${id}`, (await read(p)).camera.enabled === false)
      for (let i = 0; i < 6; i++) {
        const now = await read(p)
        if (Math.hypot(...now.parts[id].world.map((v, j) => v - now.parts[id].slotWorld[j])) < .12) break
        const at = now.drag?.drop || now.parts[id].slot
        await p.mouse.move(at.x, at.y, { steps: 4 }); await wait(120)
      }
      const release = await read(p)
      const error = Math.hypot(...release.parts[id].world.map((v, j) => v - release.parts[id].slotWorld[j])).toFixed(3)
      await p.mouse.up()
      const seated = await p.waitForFunction(id => window.__VOLTA__.read().state.installed.includes(id), id, { timeout: 25000 }).then(() => true).catch(() => false)
      if (seated) { check(`${id} installed by physical drag (release error ${error}m)`, true); await settle(p); return }
      await p.waitForFunction(() => !window.__VOLTA__.read().state.seating, null, { timeout: 25000 }).catch(() => {})
    } else await p.mouse.up()
  }
  await select(p, id, touch)
  check(`the ${id} slot marker stays hittable while the camera rests`, await hitMarker(p, `[data-slot="${id}"]`, touch))
  const marker = await p.waitForFunction(id => window.__VOLTA__.read().state.installed.includes(id), id, { timeout: 25000 }).then(() => true).catch(() => false)
  if (!marker) throw Error(`${id} placement refused: ${JSON.stringify((await read(p)).state.notice)}`)
  check(`${id} installed through ${touch ? 'touch selection' : 'slot marker'}`, true)
  await settle(p)
}
async function heat(p, action) { await p.locator('[data-testid="heat"]').dispatchEvent(action) }
async function solder(p) {
  await p.locator('[data-testid="heat"]').waitFor()
  for (let i = 0; i < 500; i++) {
    const s = (await read(p)).state
    if (s.soldered) break
    if (s.temp > 235) { await heat(p, 'pointerup'); await wait(90) } else if (!s.heating) { await heat(p, 'pointerdown') }
    await wait(50)
  }
  if (await p.locator('[data-testid="heat"]').count()) await heat(p, 'pointerup')
  const s = (await read(p)).state
  check('reflow completes inside 200-275C', s.soldered && s.temp <= SOLDER.ceiling && s.reflow === 100)
  check('the reflow station retires once the joint is solid', (await p.locator('[data-testid="solder-station"]').count()) === 0)
}
async function pokePort(p, id) {
  return p.evaluate(selector => {
    const el = document.querySelector(selector)
    if (!el || getComputedStyle(el).visibility !== 'visible') return false
    const r = el.getBoundingClientRect()
    const init = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1, isPrimary: true }
    el.dispatchEvent(new PointerEvent('pointerdown', init))
    window.dispatchEvent(new PointerEvent('pointerup', init))
    return true
  }, `[data-port="${id}"]`)
}
async function tapPort(p, id, touch = false) {
  const picked = s => s.source === id || s.wires.some(w => WIRES[w].ends.includes(id))
  for (let i = 0; i < 4; i++) {
    await hitMarker(p, `[data-port="${id}"]`, touch).catch(() => false)
    if (picked((await read(p)).state)) return true
    await pokePort(p, id)
    if (picked((await read(p)).state)) return true
    await wait(220)
  }
  return false
}
async function wire(p, a, b, touch = false) {
  if ((await read(p)).state.mode !== 'wires') await p.getByTestId('wires-mode')[touch ? 'tap' : 'click']()
  const before = (await read(p)).state.wires.length
  const done = async () => (await read(p)).state.wires.length > before
  const drag = async () => {
    const from = await p.locator(`[data-port="${a}"]`).boundingBox(), to = await p.locator(`[data-port="${b}"]`).boundingBox()
    if (!from || !to) return false
    await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await p.mouse.down()
    await p.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 }); await p.mouse.up(); await wait(140)
    return done()
  }
  const taps = async () => {
    await tapPort(p, a, touch)
    if (await done()) return true
    await tapPort(p, b, touch); await wait(140); return done()
  }
  const dragged = !touch && await drag()
  check(`${a} → ${b} connected by ${dragged ? 'cable drag' : 'port taps'}`, dragged || await taps())
}
async function assemble(p, { touch = false, mistakes = false } = {}) {
  if (mistakes) {
    await p.getByTestId('power')[touch ? 'tap' : 'click']()
    check('an empty machine cannot boot', (await read(p)).state.power === 'off')
    check('the preflight names the first piece', (await read(p)).state.notice.detail.includes(PARTS.shield.name))
    await select(p, 'board', touch)
    await hitMarker(p, '[data-slot="board"]', touch)
    check('the board waits for the IO shield', (await read(p)).state.notice.detail.includes(PARTS.shield.name))
    await select(p, 'fan', touch)
    await hitMarker(p, '[data-slot="fan"]', touch)
    check('the fan cannot precede the fin stack', (await read(p)).state.notice.detail.includes(PARTS.heatsink.name))
  }
  await place(p, 'shield', touch)
  await place(p, 'board', touch)
  if (mistakes) {
    await select(p, 'cooler', touch)
    await hitMarker(p, '[data-slot="cooler"]', touch)
    check('the tower cooler waits for the memory', (await read(p)).state.notice.detail.includes(PARTS.dimmA.name))
  }
  await orient(p, 'cpu', touch); await place(p, 'cpu', touch)
  await place(p, 'dimmA', touch); await place(p, 'dimmB', touch)
  await place(p, 'psu', touch)
  await place(p, 'cooler', touch)
  check('the platform is bolted down', (await read(p)).state.installed.length === PLATFORM_IDS.length)
  await place(p, 'pcb', touch)
  if (mistakes) {
    await select(p, 'core', touch)
    await hitMarker(p, '[data-slot="core"]', touch)
    check('a rotated die is refused', (await read(p)).state.notice.detail.includes('方向'))
  }
  await orient(p, 'core', touch); await place(p, 'core', touch)
  check('the reflow station appears once the die sits down', await p.locator('[data-testid="heat"]').isVisible())
  await solder(p)
  await place(p, 'heatsink', touch)
  await orient(p, 'fan', touch); await place(p, 'fan', touch)
  check('eleven modules are physically installed', (await read(p)).state.installed.length === PART_IDS.length)
  if (mistakes) {
    const refused = async () => (await read(p)).state.notice.detail.includes('不兼容')
    await p.getByTestId('wires-mode')[touch ? 'tap' : 'click']()
    let done = false, how = ''
    const from = touch ? null : await p.locator('[data-port="F1"]').boundingBox()
    const to = touch ? null : await p.locator('[data-port="D2"]').boundingBox()
    if (from && to) {
      await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await p.mouse.down()
      await p.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 }); await p.mouse.up(); await wait(200)
      if (await refused()) { done = true; how = 'a cable dragged from F1 to D2' }
    }
    if (!done) {
      await tapPort(p, 'F1', touch)
      await hitMarker(p, '[data-port="D2"]', touch); await wait(160)
      if (!(await refused())) await pokePort(p, 'D2')
      if (await refused()) { done = true; how = 'taps on F1 then D2' }
    }
    check(`${how || 'incompatible ports'} refused`, done && (await read(p)).state.wires.length === 0)
  }
  await wire(p, 'F1', 'F2', touch)
  if (mistakes) {
    await p.getByTestId('power')[touch ? 'tap' : 'click']()
    check('an unmounted card cannot boot', (await read(p)).state.power === 'off' && (await read(p)).state.notice.detail.includes('PCIe'))
  }
  const d = await read(p)
  check('the whole card is grabbable', d.card.ready && (touch || await onCanvas(p, d.card.screen)))
  if (!touch) {
    await p.mouse.move(d.card.screen.x, d.card.screen.y); await p.mouse.down(); await wait(90)
    await p.mouse.move(d.card.screen.x + 90, d.card.screen.y - 40, { steps: 10 }); await wait(120)
    const mid = await read(p)
    check('dragging lifts every module together', mid.cardDrag?.moved === true && mid.card.transform.every(v => Number.isFinite(v)))
    await p.mouse.up(); await wait(260)
    check('a card far from the slot is refused', (await read(p)).state.card === 'bench' && (await read(p)).state.notice.detail.includes('金手指'))
  }
  await settle(p)
  if ((await read(p)).state.mode === 'wires') { await p.getByTestId('parts-mode')[touch ? 'tap' : 'click'](); await wait(180) }
  await hitMarker(p, '[data-anchor="mount"]', touch)
  const seat = async (ms = 12000) => p.waitForFunction(() => window.__VOLTA__.read().state.card === 'mounted', null, { timeout: ms }).then(() => true).catch(() => false)
  let seated = await seat()
  const tried = ['marker']
  if (!seated && touch) {
    await p.evaluate(() => {
      window.__CLICKS__ = []
      addEventListener('click', e => window.__CLICKS__.push(`${e.target?.tagName}:${e.target?.className ?? ''}`), true)
    })
    if (await p.locator('[data-anchor="mount"]').isVisible().catch(() => false)) { await p.locator('[data-anchor="mount"]').tap().catch(() => {}); tried.push('locator tap') }
    seated = await seat()
    if (!seated) {
      const d = await read(p)
      console.log('MOUNT DIAG', JSON.stringify({ clicks: await p.evaluate(() => window.__CLICKS__), card: d.state.card, notice: d.state.notice, transform: d.card?.transform?.map(v => +v.toFixed(2)) }))
      if (await p.locator('[data-anchor="mount"]').isVisible().catch(() => false)) { await p.locator('[data-anchor="mount"]').click().catch(() => {}); tried.push('locator click') }
      seated = await seat()
    }
  }
  check(`the fingers seat into the PCIe slot (${tried.join(' → ')})`, seated)
  await settle(p)
  for (const id of ['atx', 'eps', 'pcie', 'cpufan', 'dp', 'mains']) await wire(p, ...WIRES[id].ends, touch)
  check('all seven cables are live', (await read(p)).state.wires.length === 7)
  await p.getByTestId('power')[touch ? 'tap' : 'click']()
  await p.waitForFunction(() => window.__VOLTA__.read().state.power === 'on', null, { timeout: 40000 })
  await settle(p)
}
async function setRange(p, label, value) {
  const range = p.getByRole('slider', { name: label, exact: true })
  await range.waitFor({ state: 'visible', timeout: 30000 })
  await range.click({ force: true })
  await p.keyboard.press('Home')
  for (let i = Number(await range.getAttribute('min')); i < value; i++) await p.keyboard.press('ArrowRight')
  assert.equal(Number(await range.inputValue()), value)
  await wait(400)
}
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
page.on('pageerror', e => report.errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()) })
try {
  await page.goto(url); await page.getByText('开始组装', { exact: true }).waitFor({ timeout: 90000 })
  await page.evaluate(() => document.fonts.ready); await wait(1800); await snap(page, 'hero')
  check('the header sells the GPU story', (await page.locator('.hero').innerText()).replace(/\s/g, '') === '把算力亲手焊上去开始组装')
  check('the header carries the lab name', (await page.locator('.brand').innerText()) === 'WongYam的装机Lab')
  check('the hero title uses the lapis accent', await page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.querySelector('.hero h1')).color.match(/\d+/g).map(Number)
    return b > r + 30 && b > 90
  }))
  const hero = await read(page)
  check('every module keeps its on-screen anchor', PART_IDS.every(id => hero.parts[id]?.screen.visible))
  await page.getByText('开始组装', { exact: true }).click(); await settle(page)
  check('the card brand stays fictional', (await page.locator('.workshop-footer').innerText()).includes('VOLTA G01'))
  const dockHeight = async () => (await page.locator('.assembly-dock').boundingBox()).height
  const handle = await page.getByTestId('dock-resizer').boundingBox()
  const before = await dockHeight()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, handle.y - 90, { steps: 8 }); await page.mouse.up(); await wait(220)
  const grown = await dockHeight()
  check(`the handle resizes the panel (${before.toFixed(0)}px to ${grown.toFixed(0)}px by dragging)`, grown > before + 60 && grown - before < 130)
  await page.getByTestId('dock-resizer').press('ArrowDown'); await page.getByTestId('dock-resizer').press('ArrowDown'); await wait(200)
  check('the panel handle answers the keyboard', (await dockHeight()) < grown - 20)
  await assemble(page, { mistakes: true })
  let d = await read(page)
  check('the monitor shows a decoded local movie', d.projection.video.readyState >= 2 && d.projection.video.width > 0 && d.projection.texture.kind === 'video')
  check('the picture is revealed after boot', d.projection.screen.imageVisible && d.projection.boot.phase === 'ready')
  const t = d.projection.video.currentTime; await wait(900); d = await read(page)
  check('the movie timeline advances', d.projection.video.currentTime !== t && !d.projection.video.paused)
  await page.getByTestId('play').click(); await wait(250)
  const paused = (await read(page)).projection.video.currentTime; await wait(700)
  check('pause stops the timeline', Math.abs((await read(page)).projection.video.currentTime - paused) < .08)
  await page.getByTestId('play').click(); await wait(200)
  const corners = (await read(page)).screenCorners
  // The blur radius is measured in source pixels, so the reach depends on the film's own height.
  const sourceHeight = (await read(page)).projection.video.height
  const maxBlur = 14 * sourceHeight / 360
  await setRange(page, '清晰度', 0); await snap(page, 'soft'); const soft = (await read(page)).projection.adjust
  await setRange(page, '清晰度', 100); await snap(page, 'crisp'); const crisp = (await read(page)).projection.adjust
  check(`the sharpness slider drives the shader (${soft.blur.toFixed(1)}px blur on a ${sourceHeight}p source to ${crisp.blur}px plus ${crisp.sharpen.toFixed(2)} sharpen)`,
    soft.blur > maxBlur * .9 && crisp.blur === 0 && crisp.sharpen === 1)
  report.sharpPixels = await pixelDifference('soft', 'crisp', corners)
  check('sharpness visibly changes screen pixels', report.sharpPixels.difference > 2)
  await setRange(page, '亮度', 100); await snap(page, 'bright'); await setRange(page, '亮度', 15); await snap(page, 'dim')
  report.brightPixels = await pixelDifference('bright', 'dim', corners)
  check('brightness changes real screen luminance', report.brightPixels.lumaA - report.brightPixels.lumaB > 6)
  await setRange(page, '亮度', 78)
  await setRange(page, '对比度', 0); await snap(page, 'flat'); await setRange(page, '对比度', 100); await snap(page, 'punchy')
  report.contrastPixels = await pixelDifference('flat', 'punchy', corners)
  check('contrast changes real screen pixels', report.contrastPixels.difference > 2)
  await setRange(page, '对比度', 52); await setRange(page, '清晰度', 92)
  await page.getByTestId('content-bench').click(); await wait(400); await snap(page, 'bench-pattern')
  check('the render pattern pauses the movie', (await read(page)).projection.video.paused && (await read(page)).projection.texture.kind === 'canvas')
  await page.getByTestId('content-color').click(); await wait(400); await snap(page, 'color-pattern')
  await page.getByTestId('content-film').click(); await wait(600)
  check('returning to the film resumes playback', !(await read(page)).projection.video.paused)
  await snap(page, 'bench-powered')
  await page.getByTestId('enter-desk').click(); await page.waitForFunction(() => window.__VOLTA__.read().desk.visible); await settle(page)
  check('the card comes back to a real desk', (await read(page)).state.experience === 'desk' && (await read(page)).desk.visible)
  await snap(page, 'desk-screen')
  await page.keyboard.press('KeyA'); await settle(page)
  check('A reaches the desk view', (await read(page)).state.deskView === 'desk')
  const lampBefore = (await read(page)).desk.lampIntensity
  await page.getByTestId('desk-lamp').click(); await wait(700)
  check('the desk lamp is physically interactive', !(await read(page)).state.lampOn && (await read(page)).desk.lampIntensity < lampBefore)
  await page.getByTestId('desk-next').click(); await page.getByTestId('desk-next').click(); await settle(page)
  check('navigation reaches the night window', (await read(page)).state.deskView === 'window')
  const curtainBefore = (await read(page)).desk.curtains[0]
  await page.getByTestId('desk-curtains').click(); await wait(900)
  check('the curtains slide shut', !(await read(page)).state.curtainsOpen && (await read(page)).desk.curtains[0] > curtainBefore + .1)
  await snap(page, 'desk-window')
  await page.getByTestId('desk-prev').click(); await settle(page); await page.keyboard.press('Enter'); await settle(page)
  check('Enter sits down for the film', (await read(page)).state.experience === 'cinema' && (await read(page)).state.playing)
  await snap(page, 'desk-cinema')
  const cinemaTime = (await read(page)).projection.video.currentTime; await wait(800)
  check('the movie keeps playing in cinema', (await read(page)).projection.video.currentTime > cinemaTime)
  await page.getByTestId('leave-cinema').click(); await settle(page); await page.getByTestId('desk-return').click(); await settle(page)
  check('returning to the bench keeps the build', (await read(page)).state.experience === 'bench' && (await read(page)).state.installed.length === PART_IDS.length)
  await page.getByTestId('power').click(); await wait(700)
  check('shutdown kills the picture and frees the card', (await read(page)).projection.video.paused && (await read(page)).state.power === 'off' && (await read(page)).projection.screen.reveal === 0)
  await page.getByRole('button', { name: '重新组装', exact: true }).click(); await page.getByTestId('confirm-reset').click()
  await settle(page)
  d = await read(page)
  check('reset clears parts, solder, wires and mounting', d.state.installed.length === 0 && !d.state.soldered && d.state.wires.length === 0 && d.state.card === 'bench' && d.state.epoch > 0)
  check('reset restores the picture defaults', d.state.brightness === 78 && d.state.contrast === 52 && d.state.sharpness === 54)
  for (const id of PART_IDS) assert(Math.hypot(...d.parts[id].world.map((v, i) => v - PARTS[id].home[i])) < .05, `${id} returns to its home`)
  await assemble(page)
  check('reassembly reaches a lit screen again', (await read(page)).state.power === 'on' && (await read(page)).projection.screen.imageVisible)
  await snap(page, 'cover')
  await page.close()
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  mobile.on('pageerror', e => report.errors.push(e.message))
  await mobile.goto(url); await mobile.getByText('开始组装', { exact: true }).tap(); await settle(mobile)
  await snap(mobile, 'mobile-bench')
  await assemble(mobile, { touch: true })
  check('touch assembly lights the same screen', (await read(mobile)).projection.screen.imageVisible)
  check('the phone layout never scrolls sideways', await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))
  await mobile.getByTestId('enter-desk').tap(); await mobile.waitForFunction(() => window.__VOLTA__.read().desk.visible); await settle(mobile)
  check('touch reaches the desk', (await read(mobile)).state.experience === 'desk')
  await snap(mobile, 'mobile-desk')
  await mobile.close()
  const motion = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  motion.on('pageerror', e => report.errors.push(e.message))
  await motion.goto(url); await motion.getByText('开始组装', { exact: true }).click(); await settle(motion)
  check('reduced motion is detected', await motion.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches) && (await read(motion)).reduced === true)
  await assemble(motion)
  check('reduced motion still reaches a lit screen', (await read(motion)).state.power === 'on' && (await read(motion)).projection.screen.imageVisible)
  await motion.getByTestId('enter-desk').click(); await motion.waitForFunction(() => window.__VOLTA__.read().desk.visible)
  const desk = (await read(motion)).camera.position; await wait(400)
  check('the reduced-motion camera does not drift', Math.hypot(...(await read(motion)).camera.position.map((v, i) => v - desk[i])) < .02)
  await snap(motion, 'reduced-motion')
  await motion.close()
  report.status = report.errors.length ? 'errors' : 'passed'
  if (report.errors.length) { process.exitCode = 1; console.error(report.errors.slice(0, 6)) } else console.log(`Browser passed with ${report.checks.length} checks.`)
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; console.error(error); try { await snap(page, 'failure') } catch { } } finally { await writeFile(`${out}/browser-report.json`, JSON.stringify(report, null, 2)); await browser.close() }
