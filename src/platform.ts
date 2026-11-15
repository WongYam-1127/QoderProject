import * as THREE from 'three'
import { CASE } from './config'
import { boardTexture, box, combine, cylinder, extrude, hole, label, materials, rect, rotor, screw, torus } from './models'
import type { PartId, Vec3 } from './config'

const paint = (color: string, metalness = 0, roughness = .5) => new THREE.MeshStandardMaterial({ color, metalness, roughness })
const steel = paint('#4b534f', .7, .36)
const chassis = paint('#343b38', .58, .46)
const plastic = paint('#2c322f', .26, .58)
const cream = paint('#d5d0c4', .08, .58)
const blue = paint('#3d5c8a', .34, .46)
const vent = paint('#171c19', .2, .7)

// mATX 铜柱孔位，相对板中心
const HOLES: [number, number][] = [[-1.62, -1.62], [-1.62, 0], [-1.62, 1.55], [0, -1.62], [0, 1.62], [1.62, -1.62], [1.62, 0], [1.62, 1.62], [-0.75, 0.55]]

function cut(s: THREE.Shape, x0: number, y0: number, x1: number, y1: number) {
  const h = new THREE.Path()
  h.moveTo(Math.min(x0, x1), Math.min(y0, y1)); h.lineTo(Math.max(x0, x1), Math.min(y0, y1))
  h.lineTo(Math.max(x0, x1), Math.max(y0, y1)); h.lineTo(Math.min(x0, x1), Math.max(y0, y1)); h.closePath()
  s.holes.push(h)
}

function fanUnit(parent: THREE.Object3D, name: string, pos: Vec3, blades: number, radius: number, tilt: Vec3) {
  const holder = new THREE.Group(); holder.position.set(...pos); holder.rotation.set(...tilt); parent.add(holder)
  return rotor(holder, name, blades, radius, .07)
}
function grilleRing(mesh: THREE.Mesh, radius: number) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .026, 8, 34), plastic)
  ring.rotation.x = -Math.PI / 2; ring.position.y = .03; mesh.add(ring)
}

export function createCase() {
  const g = new THREE.Group(); g.name = 'case'
  const [cx, cy, cz] = CASE.shell
  const [sx, sy, sz] = CASE.size
  const wall = .3
  box(g, [sx, .24, sz], [cx, .12, cz], chassis, .05)
  // 主板托盘：背板开窗 + 两处走线孔
  const tray = rect(4.1, 3.9, .05)
  cut(tray, -1.45, .45, -.25, 1.65)
  cut(tray, 1.05, -.55, 1.65, .05)
  cut(tray, -2.05, .85, -1.5, 1.45)
  extrude(g, tray, .05, steel, [2.55, .3, -2.35], [-Math.PI / 2, 0, 0])
  for (const [hx, hz] of HOLES) {
    const x = 2.3 + hx, z = -2.15 + hz
    cylinder(g, .085, .03, [x, .32, z], steel)
    cylinder(g, .055, .09, [x, .37, z], materials.gold)
  }
  // 后壁：IO 开口与扩展槽开口
  const wz = (v: number) => cz - v
  const wy = (v: number) => v - cy
  const rear = rect(sz, sy, .05)
  cut(rear, wz(-3.6), wy(.55), wz(-1.6), wy(1.25))
  cut(rear, wz(-1.5), wy(.5), wz(-.42), wy(2.3))
  for (let i = 0; i < 5; i++) hole(rear, wz(-4.55 + i * .16), wy(2.62), .05)
  extrude(g, rear, wall, chassis, [cx - sx / 2, cy, cz], [0, Math.PI / 2, 0])
  box(g, [.05, .08, 1.95], [.56, 1.3, -2.6], materials.orange, .008)
  for (const y of [.6, 1.44, 2.28]) box(g, [.05, .09, 1.02], [.42, y, -.96], steel, .008)
  // 顶壁：排风扇与通风孔
  const top = rect(sx, sy, .05)
  hole(top, -1.05, 0, .84)
  for (const [tx, ty] of [[-.2, 0], [.35, 0], [.35, .85], [-.2, .85], [.35, -.85], [-.2, -.85]] as const) hole(top, tx, ty, .05)
  extrude(g, top, wall, chassis, [cx, cy, cz - sz / 2])
  const exhaust = box(g, [1.75, 1.75, .1], [1.6, 1.5, -4.66], plastic, .05)
  fanUnit(exhaust, 'caseRotor', [0, 0, 0], 9, .78, [-Math.PI / 2, 0, 0])
  torus(exhaust, .82, .024, [0, 0, -.06], steel, 'z')
  for (let i = 0; i < 11; i++) box(exhaust, [1.68, .022, .04], [0, -.8 + i * .16, .05], vent, .005)
  // 前壁：风扇进风口与前面板
  const front = rect(sz, sy, .05)
  cut(front, -0.9, -0.9, 1.0, 0.9)
  for (let i = 0; i < 9; i++) hole(front, -2.1 + i * .16, 1.05, .05)
  extrude(g, front, wall, chassis, [cx + sx / 2, cy, cz], [0, -Math.PI / 2, 0])
  const intake = box(g, [.12, 1.8, 1.8], [4.66, 1.5, -1.95], plastic, .05)
  fanUnit(intake, 'intakeRotor', [0, 0, 0], 9, .8, [0, 0, -Math.PI / 2])
  torus(intake, .84, .024, [-.07, 0, 0], steel, 'x')
  const io = box(g, [.12, 1.5, 1.2], [4.98, 1.4, .1], plastic, .03)
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) box(io, [.07, .11, .15], [.05, -.35 + i * .5, -.3 + j * .3], cream, .008)
  for (const y of [-.5, .5]) cylinder(g, .045, .06, [5.04, 1.4 + y, .55], vent, 'x')
  const button = new THREE.Group(); button.name = 'casePower'; button.userData.control = 'power'; button.position.set(5.06, 2.42, -4.32); g.add(button)
  cylinder(button, .19, .1, [0, 0, 0], steel, 'x')
  cylinder(button, .14, .07, [.07, 0, 0], materials.orange, 'x')
  torus(button, .18, .013, [.03, 0, 0], materials.cream, 'x')
  const ledMat = new THREE.MeshStandardMaterial({ color: '#5d6a5e', emissive: '#c8e2a6', emissiveIntensity: 0, roughness: .3 })
  cylinder(g, .032, .05, [5.05, 2.42, -4.0], ledMat, 'x').name = 'powerLed'
  label(g, 'VOLTA mATX · POWER', [4.9, 1.4, .1], .9, '#9aa39a')
  // 开口边折边
  const rim = cy + sy / 2 - .07
  for (const z of [cz - sz / 2 + .06, cz + sz / 2 - .06]) box(g, [sx, .13, .14], [cx, rim, z], steel, .02)
  for (const x of [cx - sx / 2 + .08, cx + sx / 2 - .08]) box(g, [.14, .13, sz], [x, rim, cz], steel, .02)
  for (const x of [.62, 4.55]) for (const z of [-4.5, .68]) box(g, [.14, .5, .14], [x, .32, z], chassis, .02)
  return g
}

export function createPowerStrip() {
  const g = new THREE.Group(); g.name = 'powerStrip'; g.position.set(5.75, 0, 1.6)
  box(g, [1.5, .3, .34], [0, .15, 0], plastic, .06)
  for (let i = 0; i < 3; i++) {
    const face = box(g, [.3, .05, .24], [-.45 + i * .45, .3, 0], vent, .02)
    for (const dx of [-.06, .06]) box(face, [.03, .04, .03], [dx, .015, 0], materials.gold, .004)
    box(face, [.02, .04, .1], [0, .015, 0], materials.ink, .004)
  }
  cylinder(g, .07, .05, [.66, .3, 0], materials.orange)
  label(g, '6 OUTLET 10A', [-.05, .02, .3], .8, '#8b9184')
  return g
}

function board(g: THREE.Group) {
  const shape = rect(3.5, 3.5, .06)
  for (const [x, z] of HOLES) hole(shape, x, z, .05)
  extrude(g, shape, .14, materials.pcb, [0, -.07, 0], [-Math.PI / 2, 0, 0])
  const top = new THREE.Mesh(new THREE.PlaneGeometry(3.46, 3.46), new THREE.MeshStandardMaterial({ map: boardTexture([
    ['VOLTA MB-01 · mATX', 250, 452, '500 30px monospace'], ['LGA 1700', 300, 120, '500 26px monospace'], ['DIMM A2 / B2', 690, 250, '500 24px monospace'], ['PCIE X16', 110, 250, '500 24px monospace'], ['ATX 24-PIN', 840, 60, '500 22px monospace']
  ]), roughness: .7, metalness: .26 }))
  top.rotation.x = -Math.PI / 2; top.position.y = .072; top.receiveShadow = true; g.add(top)
  for (const [x, z] of HOLES) screw(g, [x, .076, z], .046)
  // CPU 插座：框体、针脚盘、 Load 压板与拉杆、金色三角
  const socket = new THREE.Group(); socket.name = 'cpuSocket'; socket.position.set(-0.7, .09, -0.85); g.add(socket)
  box(socket, [.86, .08, .86], [0, 0, 0], plastic, .02)
  box(socket, [.7, .03, .7], [0, .05, 0], paint('#5a6360', .72, .3), .008)
  const pins: THREE.Mesh[] = []
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) pins.push(box(socket, [.042, .012, .042], [-.24 + i * .06, .072, -.24 + j * .06], materials.gold, .003))
  combine(socket, pins, materials.gold)
  box(socket, [.9, .04, .1], [0, .07, .43], steel, .01)
  box(socket, [.1, .05, .92], [.45, .06, 0], steel, .012)
  const lever = new THREE.Group(); lever.position.set(.52, .06, -.44); socket.add(lever)
  cylinder(lever, .022, .5, [0, 0, .26], materials.metal, 'z')
  cylinder(lever, .022, .3, [0, .16, .5], materials.metal)
  box(lever, [.09, .07, .13], [0, .32, .5], materials.orange, .012)
  box(socket, [.13, .014, .13], [-.35, .079, -.35], materials.gold, .004)
  // 四条内存槽，A2 / B2 用橙色卡扣标出
  for (let i = 0; i < 4; i++) {
    const used = i === 1 || i === 3
    const slot = box(g, [.13, .18, 1.5], [.7 + i * .25, .13, -0.75], used ? paint('#38403c', .4, .5) : plastic, .015)
    box(slot, [.06, .1, 1.36], [0, .02, 0], materials.gold, .006)
    for (const z of [-.79, .79]) box(g, [.14, .2, .1], [.7 + i * .25, .12, -0.75 + z], used ? materials.orange : cream, .012)
  }
  // 24-pin 与 EPS 8-pin
  const atx = box(g, [.18, .3, .62], [1.62, .13, .05], cream, .015)
  for (let i = 0; i < 12; i++) box(atx, [.1, .18, .034], [0, 0, -.27 + i * .05], vent, .003)
  box(g, [.5, .24, .16], [-1.45, .13, -1.55], plastic, .012)
  for (let i = 0; i < 4; i++) { box(g, [.04, .14, .04], [-1.6 + i * .085, .18, -1.59], materials.gold, .003); box(g, [.04, .14, .04], [-1.6 + i * .085, .18, -1.51], materials.gold, .003) }
  const fanHeader = box(g, [.2, .12, .09], [0, .08, -1.55], cream, .008)
  for (let i = 0; i < 4; i++) box(fanHeader, [.03, .07, .03], [-.06 + i * .04, .12, 0], materials.gold, .002)
  box(fanHeader, [.055, .02, .09], [-.085, .13, 0], materials.orange, .002)
  for (const z of [-1.6, -.75]) {
    const h = box(g, [.2, .1, .09], [1.55, .08, z], cream, .008)
    for (let i = 0; i < 4; i++) box(h, [.026, .06, .026], [-.06 + i * .04, .1, 0], materials.gold, .002)
  }
  // VRM 散热片
  const vrmA = box(g, [.35, .56, 1.3], [-1.35, .28, .15], materials.fin, .02)
  const finsA: THREE.Mesh[] = []
  for (let i = 0; i < 13; i++) finsA.push(box(vrmA, [.33, .5, .03], [0, 0, -.58 + i * .096], materials.fin, .004))
  combine(vrmA, finsA, materials.fin)
  const vrmB = box(g, [.55, .18, .5], [-0.4, .09, -1.5], materials.fin, .02)
  const finsB: THREE.Mesh[] = []
  for (let i = 0; i < 6; i++) finsB.push(box(vrmB, [.53, .16, .03], [0, 0, -.2 + i * .08], materials.fin, .004))
  combine(vrmB, finsB, materials.fin)
  // PCIe x16（金属加固 + 橙色卡扣）与 x1
  const x16 = new THREE.Group(); x16.name = 'pcieSlot'; x16.position.set(-0.75, .16, 1.6); g.add(x16)
  box(x16, [1.55, .14, .24], [0, 0, 0], paint('#3c4340', .55, .4), .02)
  box(x16, [1.44, .05, .1], [0, -.03, 0], materials.gold, .006)
  box(x16, [1.57, .012, .26], [0, .075, 0], steel, .004)
  box(x16, [.14, .16, .26], [-.74, .02, 0], materials.orange, .015)
  box(g, [.75, .12, .2], [-0.95, .12, 1.2], plastic, .015)
  box(g, [.3, .05, .18], [-0.95, .16, 1.2], materials.orange, .01)
  // 后部 IO 堆栈
  const stack = new THREE.Group(); stack.name = 'ioStack'; stack.position.set(-1.68, .18, -0.45); g.add(stack)
  box(stack, [.1, .34, 1.9], [0, 0, 0], steel, .015)
  const shells: THREE.Mesh[] = []
  shells.push(box(stack, [.13, .14, .16], [-.02, .1, -.82], paint('#5a4a7a', .35, .5), .01))
  for (let i = 0; i < 4; i++) shells.push(box(stack, [.13, .12, .17], [-.02, .1, -.52 + i * .2], cream, .01))
  shells.push(box(stack, [.13, .14, .22], [-.02, .06, .12], materials.metal, .01))
  shells.push(box(stack, [.13, .12, .24], [-.02, .06, .4], plastic, .01))
  shells.push(box(stack, [.13, .12, .26], [-.02, .06, .68], materials.ink, .01))
  for (let i = 0; i < 3; i++) shells.push(box(stack, [.13, .1, .1], [-.02, .06, .9 + i * .13], paint(['#5c8f6b', '#8a5c8f', '#8f5c5c'][i], .3, .5), .008))
  combine(stack, shells, paint('#8c9490', .7, .34))
  for (let i = 0; i < 4; i++) box(stack, [.04, .05, .11], [-.08, .13, -.52 + i * .2], vent, .004)
  box(stack, [.04, .06, .2], [-.08, .06, .68], vent, .004)
  // SATA、M.2、纽扣电池、前面板针脚
  for (let i = 0; i < 2; i++) {
    const sata = box(g, [.14, .2, .34], [1.6, .1, i * .36 - 1.42], plastic, .012)
    for (let j = 0; j < 4; j++) box(sata, [.1, .02, .055], [.02, -.06 + j * .045, 0], materials.gold, .003)
  }
  const m2 = box(g, [.3, .06, 1.15], [.1, .08, .3], paint('#2b3130', .4, .5), .012)
  for (let i = 0; i < 4; i++) box(m2, [.16, .02, .12], [0, .04, -.4 + i * .26], materials.ink, .005)
  label(m2, 'M.2 NVMe', [0, .045, 0], .24, '#93a09a')
  box(g, [.1, .05, .1], [.1, .07, .95], materials.metal, .004)
  cylinder(g, .13, .05, [-1.3, .09, .35], materials.metal)
  torus(g, .13, .012, [-1.3, .115, .35], steel)
  const fpanel = box(g, [.34, .1, .2], [.6, .05, 1.72], plastic, .008)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) box(fpanel, [.022, .07, .022], [-.12 + i * .08, .06, -.04 + j * .08], materials.gold, .002)
  box(g, [.3, .1, .14], [1.35, .05, 1.68], blue, .01)
  label(g, 'F_PANEL', [.62, .078, 1.5], .28, '#8a948a')
  label(g, 'MB-01 mATX', [1.05, .076, -1.66], .5, '#7c867c')
  const caps: THREE.Mesh[] = []
  for (let i = 0; i < 18; i++) caps.push(box(g, [.07, .05, .1], [-.35 + (i % 9) * .09, .1, -1.25 + Math.floor(i / 9) * .12], materials.ink, .005))
  for (let i = 0; i < 10; i++) caps.push(box(g, [.09, .07, .09], [-1.5 + (i % 5) * .12, .11, -.6 + Math.floor(i / 5) * .12], paint('#6d7469', .5, .45), .006))
  combine(g, caps, paint('#454d48', .45, .5))
}

function cpu(g: THREE.Group) {
  box(g, [.62, .04, .62], [0, -.03, 0], paint('#23405c', .3, .55), .012)
  const ihs = box(g, [.52, .06, .52], [0, .02, 0], materials.metal, .012)
  ihs.name = 'cpuIhs'
  box(g, [.44, .008, .44], [0, .055, 0], paint('#a7ada6', .8, .22), .004)
  const pads: THREE.Mesh[] = []
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) pads.push(box(g, [.03, .012, .03], [-.16 + i * .046, -.055, -.16 + j * .046], materials.gold, .002))
  combine(g, pads, materials.gold)
  for (const [x, z] of [[-.28, -.2], [-.28, .2], [.28, -.2], [.28, .2]]) box(g, [.05, .02, .05], [x, -.05, z], paint('#c9c3b2', .3, .5), .004)
  box(g, [.1, .014, .1], [-.22, -.046, -.22], materials.gold, .003)
  box(g, [.05, .012, .14], [.31, -.03, 0], materials.orange, .003)
  label(g, 'VOLTA CORE', [0, .061, 0], .3, '#8e958e')
}

function cooler(g: THREE.Group) {
  const base = box(g, [.95, .12, .95], [0, -.45, .55], paint('#8a938e', .82, .26), .02)
  box(base, [.72, .03, .72], [0, -.06, 0], materials.copper, .006)
  for (const [x, z] of [[-.42, .07], [.42, .07], [-.42, 1.02], [.42, 1.02]]) box(g, [.16, .1, .16], [x, -.4, z], materials.rubber, .02)
  const bars: THREE.Mesh[] = []
  for (const x of [-.44, .44]) bars.push(box(g, [.1, .06, 1.5], [x, -.36, .3], steel, .01))
  combine(g, bars, steel)
  for (const [x, z] of [[-.44, -.42], [.44, -.42], [-.44, 1.02], [.44, 1.02]]) screw(g, [x, -.3, z], .034)
  for (let i = 0; i < 5; i++) {
    const z = .3 - i * .16
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.3 + i * .15, -.4, .5), new THREE.Vector3(-.3 + i * .15, -.05, z),
      new THREE.Vector3(-.3 + i * .15, .05, z - .7), new THREE.Vector3(-.3 + i * .15, -.1, z - 1.15)
    ])
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .036, 8, false), materials.copper)
    pipe.castShadow = true; g.add(pipe)
  }
  const stack: THREE.Mesh[] = []
  for (let i = 0; i < 20; i++) stack.push(box(g, [1.05, 1.28, .03], [0, .05, -.1 - i * .055], materials.fin, .004))
  combine(g, stack, materials.fin)
  for (const z of [-.13, -1.2]) box(g, [1.1, 1.32, .06], [0, .05, z], paint('#767f7a', .8, .3), .012)
  const shroud = box(g, [1.12, 1.34, .32], [0, .05, -.3], materials.graphite, .04)
  label(shroud, 'VOLTA AIRFLOW', [0, 0, .17], .66, '#a9b2a9')
  const frame = box(g, [.2, 1.3, 1.3], [.66, .05, -.85], plastic, .05)
  grilleRing(frame, .58)
  const wheel = fanUnit(frame, 'coolerRotor', [0, 0, 0], 9, .55, [-Math.PI / 2, 0, 0])
  label(wheel, 'AIR', [0, .09, 0], .2, '#9fa8a0')
  for (const [y, z] of [[-.52, -.52], [.62, -.52], [-.52, .62], [.62, .62]]) screw(frame, [0, y, z], .03)
  const terminal = box(g, [.18, .12, .14], [.55, -.53, .2], cream, .01)
  terminal.name = 'coolerTerminal'
  for (let i = 0; i < 4; i++) box(terminal, [.026, .07, .026], [-.06 + i * .04, .07, 0], materials.gold, .002)
  box(terminal, [.05, .02, .1], [0, .08, -.06], materials.orange, .003)
}

function dimm(g: THREE.Group) {
  box(g, [.06, .42, 1.44], [0, .02, 0], paint('#1f3a2c', .3, .6), .008)
  const spreader: THREE.Mesh[] = []
  for (const x of [-.055, .055]) spreader.push(box(g, [.04, .46, 1.46], [x, .04, 0], paint('#8f9a94', .76, .3), .008))
  combine(g, spreader, paint('#8f9a94', .76, .3))
  box(g, [.14, .06, 1.46], [0, .26, 0], materials.graphite, .01)
  box(g, [.145, .02, .32], [0, .295, -.5], materials.orange, .004)
  const chips: THREE.Mesh[] = []
  for (const x of [-.032, .032]) for (let i = 0; i < 8; i++) chips.push(box(g, [.012, .12, .14], [x, .02, -.6 + i * .17], materials.ink, .004))
  combine(g, chips, materials.ink)
  const fingers: THREE.Mesh[] = []
  for (let i = 0; i < 30; i++) {
    const z = -.66 + i * .045
    if (z > -.06 && z < .06) continue
    fingers.push(box(g, [.05, .09, .03], [0, -.22, z], materials.gold, .002))
  }
  combine(g, fingers, materials.gold)
  label(g, 'DDR5', [0, .3, .35], .22, '#c6ccc4')
}

function shield(g: THREE.Group) {
  const plate = rect(2.2, .62, .04)
  cut(plate, -.95, -.2, -.5, .2)
  cut(plate, -.4, -.16, .1, .16)
  cut(plate, .2, -.18, .55, .18)
  cut(plate, .68, -.12, .95, .12)
  extrude(g, plate, .03, materials.metal, [0, 0, 0], [0, Math.PI / 2, 0])
  for (const z of [-1.08, -.42, .42, 1.08]) box(g, [.06, .5, .05], [0, 0, z], steel, .01)
  const lips: THREE.Mesh[] = []
  for (const y of [-.33, .33]) lips.push(box(g, [.05, .04, 2.18], [0, y, 0], steel, .006))
  combine(g, lips, steel)
  for (let i = 0; i < 7; i++) box(g, [.05, .05, .04], [.02, .3, -.9 + i * .3], materials.ink, .004)
  label(g, 'IO SHIELD', [-.02, -.35, .6], .36, '#8b9184')
}

function psu(g: THREE.Group) {
  box(g, [2.3, 2.1, 1.2], [0, 0, 0], paint('#3b423f', .5, .48), .07)
  const grille = box(g, [2.02, 1.82, .05], [0, 0, .61], plastic, .04)
  grilleRing(grille, .76)
  fanUnit(grille, 'psuRotor', [0, 0, -.06], 9, .72, [-Math.PI / 2, 0, 0])
  for (let i = 1; i <= 3; i++) torus(grille, .22 * i, .013, [0, .03, .03], steel)
  // 模组接口面板
  const panel = box(g, [2.1, 1.6, .06], [0, -.05, -.61], paint('#242b28', .4, .55), .02)
  const outlets: [number, number, THREE.Material][] = [[.75, -.25, cream], [-.35, -.3, plastic], [.2, .35, plastic], [-.75, .35, plastic], [.75, .4, plastic], [-.35, .1, blue]]
  for (const [x, y, mat] of outlets) {
    const block = box(panel, [.5, .28, .12], [x, y, -.08], mat, .015)
    const pins: THREE.Mesh[] = []
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) pins.push(box(block, [.038, .06, .03], [-.19 + i * .076, -.05 + j * .1, -.05], materials.gold, .002))
    combine(block, pins, materials.gold)
    box(block, [.14, .04, .05], [0, .15, -.06], materials.orange, .004)
  }
  const inlet = box(g, [.14, .3, .38], [-1.14, -.3, .1], vent, .02)
  for (let i = 0; i < 3; i++) box(inlet, [.04, .04, .1], [.05, -.08 + i * .08, 0], materials.gold, .003)
  box(g, [.1, .16, .2], [-1.14, -.3, .52], paint('#8f2f24', .3, .5), .012)
  label(g, 'ATX 850W · 80+ GOLD', [0, 1.06, 0], 1.2, '#96a096')
  for (const [x, z] of [[-1.05, .5], [1.05, .5], [-1.05, -.5], [1.05, -.5]]) screw(g, [x, -1.06, z], .04)
}

const BUILDERS: Partial<Record<PartId, (g: THREE.Group) => void>> = { board, cpu, cooler, dimmA: dimm, dimmB: dimm, shield, psu }

export function createPlatformPart(id: PartId) {
  const g = new THREE.Group(); g.userData.part = id
  BUILDERS[id]?.(g)
  return g
}
