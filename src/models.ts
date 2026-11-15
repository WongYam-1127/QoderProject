import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { COLORS, DISPLAY, SOLDER } from './config'
import { createCase, createPowerStrip } from './platform'
import type { PartId, Vec3 } from './config'
const material = (color: string, metalness = 0, roughness = .5) => new THREE.MeshStandardMaterial({ color, metalness, roughness })
export const materials = {
  cream: material(COLORS.cream, .08, .56), metal: material(COLORS.metal, .86, .3),
  graphite: material(COLORS.graphite, .58, .36), ink: material(COLORS.ink, .42, .44),
  orange: material(COLORS.orange, .18, .4), pcb: material(COLORS.pcb, .32, .6),
  gold: material(COLORS.brass, .8, .26), rubber: material('#2a2e29', .04, .92),
  fin: material('#9ba39f', .84, .26), copper: material('#b09068', .86, .25),
  silicon: new THREE.MeshPhysicalMaterial({ color: '#8fa3a9', metalness: .62, roughness: .16, clearcoat: .7, clearcoatRoughness: .1 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#1a1f1c', metalness: .2, roughness: .12, clearcoat: .9, clearcoatRoughness: .08 }),
  solder: new THREE.MeshStandardMaterial({ color: '#b9c0bd', metalness: .82, roughness: .22, emissive: '#ff9a4e', emissiveIntensity: 0 })
}
export function box(parent: THREE.Object3D, size: Vec3, pos: Vec3, mat: THREE.Material, radius = .04) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, Math.min(radius, Math.min(...size) / 3)), mat)
  mesh.position.set(...pos); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
}
export function cylinder(parent: THREE.Object3D, r: number, height: number, pos: Vec3, mat: THREE.Material, axis: 'x' | 'y' | 'z' = 'y') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, height, 40), mat)
  if (axis === 'x') m.rotation.z = Math.PI / 2
  if (axis === 'z') m.rotation.x = Math.PI / 2
  m.position.set(...pos); m.castShadow = m.receiveShadow = true; parent.add(m); return m
}
export function label(parent: THREE.Object3D, text: string, pos: Vec3, width = 1, color = '#696c63', floor = true) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128
  const ctx = c.getContext('2d')!; ctx.fillStyle = color; ctx.font = '500 53px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 64)
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 8), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
  if (floor) m.rotation.x = -Math.PI / 2; else m.rotation.y = Math.PI
  m.position.set(...pos); parent.add(m); return m
}
export function rect(w: number, h: number, r: number) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y)
  return s
}
export function hole(s: THREE.Shape, x: number, y: number, radius: number) { const h = new THREE.Path(); h.absarc(x,y,radius,0,Math.PI*2,true); s.holes.push(h) }
export function extrude(parent: THREE.Object3D, shape: THREE.Shape, depth: number, mat: THREE.Material, pos: Vec3, rotation: Vec3 = [0,0,0]) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .016, bevelThickness: .012, curveSegments: 14 })
  const m = new THREE.Mesh(g, mat); m.position.set(...pos); m.rotation.set(...rotation); m.castShadow = m.receiveShadow = true; parent.add(m); return m
}
export function torus(parent: THREE.Object3D, r: number, tube: number, pos: Vec3, mat: THREE.Material, axis = 'y') {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,48),mat); m.position.set(...pos)
  if (axis === 'y') m.rotation.x = -Math.PI/2
  if (axis === 'x') m.rotation.y = Math.PI/2
  m.castShadow = true; parent.add(m); return m
}
export function screw(parent: THREE.Object3D, pos: Vec3, radius = .045) {
  cylinder(parent,radius,.024,pos,materials.metal)
  box(parent,[radius*1.3,.005,.012],[pos[0],pos[1]+.013,pos[2]],materials.ink,.001)
  box(parent,[.012,.005,radius*1.3],[pos[0],pos[1]+.013,pos[2]],materials.ink,.001)
}
export function combine(parent: THREE.Object3D, meshes: THREE.Mesh[], mat: THREE.Material) {
  const geometries = meshes.map(m => {m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix)})
  const merged = mergeGeometries(geometries)
  if (merged) { const m = new THREE.Mesh(merged, mat); m.castShadow = m.receiveShadow = true; parent.add(m); meshes.forEach(m => {m.removeFromParent();m.geometry.dispose()}) }
  geometries.forEach(g => g.dispose())
}
export function rotor(parent: THREE.Object3D, name: string, blades: number, radius: number, pitch = .1) {
  const group = new THREE.Group(); group.name = name; parent.add(group)
  cylinder(group, radius * .22, pitch * 1.5, [0, 0, 0], materials.metal)
  const bladeMat = material('#4a534f', .48, .42)
  const bladesMesh: THREE.Mesh[] = []
  for (let i = 0; i < blades; i++) {
    const b = new THREE.Shape()
    b.moveTo(radius * .2, -.03); b.quadraticCurveTo(radius * .55, -.15, radius * .92, -.09)
    b.quadraticCurveTo(radius, .02, radius * .88, .13); b.quadraticCurveTo(radius * .5, .08, radius * .21, .06); b.closePath()
    const m = extrude(group, b, pitch * .3, bladeMat, [0, pitch * .2, 0], [-Math.PI / 2, 0, 0])
    m.rotation.z = i * Math.PI * 2 / blades; bladesMesh.push(m)
  }
  combine(group, bladesMesh, bladeMat)
  cylinder(group, radius * .17, pitch * .2, [0, pitch * .85, 0], materials.ink)
  return group
}
export function boardTexture(lines: [string, number, number, string][]) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 480
  const ctx = c.getContext('2d')!; ctx.fillStyle = '#1c211d'; ctx.fillRect(0, 0, 1024, 480)
  ctx.strokeStyle = '#3f4a4238'; ctx.lineWidth = 2
  for (let i = 0; i < 26; i++) {
    ctx.beginPath(); ctx.moveTo(60 + i * 18, 452); ctx.lineTo(60 + i * 18, 300 - i * 6)
    ctx.lineTo(520 + i * 9, 150 - i * 3); ctx.lineTo(980, 150 - i * 3); ctx.stroke()
  }
  ctx.strokeStyle = '#4c5a4f55'; ctx.lineWidth = 3
  ctx.strokeRect(300, 150, 210, 200); ctx.strokeRect(700, 90, 150, 90); ctx.strokeRect(70, 320, 180, 90)
  ctx.fillStyle = '#8d9a8f'
  for (const [text, x, y, font] of lines) { ctx.font = font; ctx.fillText(text, x, y) }
  ctx.fillStyle = '#a58a55'
  for (const [x, y] of [[38, 38], [986, 38], [38, 442], [986, 442]] as const) { ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill() }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4
  return texture
}
export function createBase() {
  const g = new THREE.Group()
  const stand = new THREE.Group(); stand.name = 'stand'; g.add(stand)
  for (const x of [-4.35, -0.85]) for (const z of [-.4, 1.2]) {
    cylinder(stand, .17, .12, [x, .06, z], materials.rubber)
    cylinder(stand, .085, .2, [x, .36, z], materials.gold)
    torus(stand, .036, .008, [x, .46, z], materials.ink)
  }
  box(stand, [.14, .03, .13], [-4.42, .47, 1.14], materials.orange, .012)
  label(stand, 'VOLTA G01 / CARRIER BOARD', [-3.6, .47, 1.62], 1.5, '#8d9488')
  g.add(createCase(), createPowerStrip())
  return g
}
export function createMonitor() {
  const g = new THREE.Group(); g.position.set(DISPLAY.panel[0], 0, DISPLAY.panel[2] + .06)
  const bezel = box(g, [DISPLAY.width + .16, DISPLAY.height + .16, .12], [0, DISPLAY.panel[1], .06], materials.graphite, .04)
  bezel.name = 'monitorBezel'
  box(g, [DISPLAY.width + .02, DISPLAY.height + .02, .02], [0, DISPLAY.panel[1], -.005], materials.ink, .01)
  const glowMat = new THREE.MeshStandardMaterial({ color: '#4a544d', emissive: '#ffd6a8', emissiveIntensity: 0, roughness: .35 })
  const led = box(g, [.07, .02, .02], [DISPLAY.width / 2 - .12, DISPLAY.panel[1] - DISPLAY.height / 2 - .02, -.03], glowMat); led.name = 'monitorLed'
  box(g, [.9, .05, .5], [0, .03, .3], materials.graphite, .03)
  cylinder(g, .075, 1.0, [0, .53, .3], materials.graphite)
  const dpIn = box(g, [.24, .12, .06], [-.58, 1.4, .22], materials.ink, .012)
  dpIn.name = 'monitorDpIn'
  box(g, [.16, .05, .03], [-.58, 1.4, .25], materials.gold, .004)
  label(g, 'DISPLAYPORT IN', [-.58, 1.24, .27], .5, '#7d857c')
  const osd = new THREE.Group(); osd.name = 'monitorOsd'; osd.position.set(DISPLAY.width / 2 - .3, DISPLAY.panel[1] - DISPLAY.height / 2 - .1, -.03); g.add(osd)
  cylinder(osd, .035, .08, [0, 0, 0], materials.metal, 'z')
  label(g, 'VOLTA DISPLAY 27', [-.6, DISPLAY.panel[1] - DISPLAY.height / 2 - .1, -.07], .7, '#7d857c', false)
  return g
}
export function createReflow() {
  const g = new THREE.Group(); g.name = 'reflowHead'; g.userData.control = 'heat'
  g.position.set(...SOLDER.head)
  box(g, [.5, .34, .5], [0, .34, 0], material('#4d5551', .6, .38), .05)
  const nozzle = cylinder(g, .12, .2, [0, .06, 0], materials.metal)
  nozzle.name = 'reflowNozzle'
  const coilMat = new THREE.MeshStandardMaterial({ color: '#5a4a3e', emissive: '#ff7a2e', emissiveIntensity: 0, roughness: .4, metalness: .5 })
  const coil = cylinder(g, .14, .05, [0, -.06, 0], coilMat); coil.name = 'heatCoil'
  for (let i = 0; i < 4; i++) torus(g, .15, .012, [0, -.02 - i * .022, 0], materials.copper)
  cylinder(g, .05, .5, [0, .72, 0], materials.rubber, 'y')
  box(g, [.16, .16, .9], [0, .82, .45], materials.graphite, .03)
  label(g, 'REFLOW 245', [-.02, .34, -.26], .34, '#8d9488', false)
  g.visible = false
  return g
}
function pcb(g: THREE.Group) {
  const shape = rect(3.9, 1.75, .07)
  hole(shape, -1.78, .72, .05); hole(shape, 1.78, .72, .05); hole(shape, -1.78, -.72, .05); hole(shape, 1.78, -.72, .05)
  extrude(g, shape, .12, materials.pcb, [0, -.06, 0], [-Math.PI / 2, 0, 0])
  const top = new THREE.Mesh(new THREE.PlaneGeometry(3.86, 1.71), new THREE.MeshStandardMaterial({ map: boardTexture([
    ['VOLTA G01 · REV A', 60, 440, '500 30px monospace'], ['REFLOW / GPU DIE', 330, 60, '500 26px monospace'], ['FAN HEADER', 760, 430, '500 24px monospace'], ['12V-2x6', 830, 90, '500 24px monospace']
  ]), roughness: .66, metalness: .3 }))
  top.rotation.x = -Math.PI / 2; top.position.y = .062; top.receiveShadow = true; g.add(top)
  const fingers: THREE.Mesh[] = []
  for (let i = 0; i < 12; i++) {
    const x = -1.78 + i * .135
    if (x > -1.5 && x < -1.28) continue
    fingers.push(box(g, [.095, .022, .2], [x, -.005, -.79], materials.gold, .004))
  }
  combine(g, fingers, materials.gold)
  box(g, [.24, .1, .21], [-1.39, .005, -.79], materials.pcb, .01)
  const die = box(g, [1.34, .03, 1.34], [.28, .068, -.02], material('#39413c', .5, .5), .012)
  die.name = 'dieFootprint'
  for (const [x, z] of [[-.36, -.68], [.92, -.68], [-.36, .64], [.92, .64]]) box(g, [.09, .012, .09], [x, .078, z], materials.orange, .006)
  const caps: THREE.Mesh[] = []
  for (let i = 0; i < 22; i++) caps.push(box(g, [.08, .05, .12], [-1.5 + (i % 11) * .14, .08, .34 + Math.floor(i / 11) * .18], material('#6d7469', .5, .45), .006))
  for (let i = 0; i < 12; i++) caps.push(box(g, [.13, .07, .17], [1.1 + (i % 4) * .19, .09, -.5 + Math.floor(i / 4) * .22], materials.ink, .008))
  combine(g, caps, material('#5c645c', .5, .5))
  for (let i = 0; i < 8; i++) cylinder(g, .052, .14, [1.15 + (i % 4) * .19, .12, .28 + Math.floor(i / 4) * .2], materials.ink)
  const header = box(g, [.28, .12, .2], [-1.65, .1, .55], materials.cream, .012)
  header.name = 'fanHeader'
  for (let i = 0; i < 4; i++) box(g, [.03, .07, .03], [-1.74 + i * .06, .16, .55], materials.gold, .003)
  box(g, [.06, .05, .24], [-1.65, .14, .68], materials.orange, .006)
  const powerSocket = box(g, [.44, .13, .2], [1.65, .035, .82], materials.ink, .012)
  powerSocket.name = 'cardPowerPort'
  box(g, [.36, .03, .13], [1.65, .1, .82], material('#141815', .2, .8), .006)
  for (let i = 0; i < 12; i++) box(g, [.04, .035, .028], [1.52 + (i % 6) * .052, .118, .795 + Math.floor(i / 6) * .05], materials.gold, .002)
  box(g, [.1, .04, .06], [1.65, .12, .72], materials.orange, .004)
  const bracket = box(g, [.07, 1.16, .5], [-1.94, .38, .02], materials.metal, .02)
  for (let i = 0; i < 4; i++) {
    const port = box(bracket, [.03, .11, .3], [.04, -.38 + i * .28, .02], materials.ink, .008)
    if (i === 3) port.scale.set(1, 1.25, 1.25)
  }
  box(bracket, [.05, .26, .3], [.03, .5, .02], materials.graphite, .01)
  for (const y of [-.16, .92]) box(g, [.05, .04, .06], [-1.94, y, .22], materials.metal, .004)
  for (const z of [-.78, .78]) box(g, [.5, .012, .05], [-1.2, .07, z], materials.metal, .004)
  const back: THREE.Mesh[] = []
  for (let i = 0; i < 26; i++) back.push(box(g, [.07, .03, .1], [-1.6 + (i % 13) * .26, -.075, -.5 + Math.floor(i / 13) * .22], material('#4a524c', .4, .55), .005))
  for (let i = 0; i < 8; i++) back.push(box(g, [.5, .028, .3], [.45 + Math.floor(i / 4) * .62, -.075, -.48 + (i % 4) * .32], materials.ink, .006))
  combine(g, back, material('#4a524c', .4, .55))
  label(g, 'G01', [-1.62, .068, -.2], .3, '#7b857b')
}
function core(g: THREE.Group) {
  box(g, [1.15, .055, 1.15], [0, -.02, 0], material('#2b3330', .42, .55), .015)
  const die = box(g, [.62, .05, .62], [0, .03, 0], materials.silicon, .006)
  die.name = 'gpuDie'
  box(g, [.5, .006, .5], [0, .058, 0], material('#b6c6cc', .8, .1), .002)
  const fillet: THREE.Mesh[] = []
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2
    fillet.push(box(g, [.035, .022, .035], [Math.cos(a) * .44, -.012, Math.sin(a) * .44], materials.solder, .006))
  }
  for (const [x, z] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) fillet.push(box(g, [.07, .02, .07], [x, -.028, z], materials.solder, .008))
  combine(g, fillet, materials.solder)
  const caps: THREE.Mesh[] = []
  for (let i = 0; i < 14; i++) caps.push(box(g, [.05, .03, .08], [-.44 + (i % 7) * .15, .02, .42 + Math.floor(i / 7) * .12], materials.ink, .004))
  combine(g, caps, materials.ink)
  box(g, [.2, .03, .05], [-.32, .002, -.56], materials.orange, .004)
  label(g, 'VOLTA GPU', [0, .011, .42], .42, '#93a3a8')
}
function heatsink(g: THREE.Group) {
  box(g, [1.5, .06, 1.4], [0, -.15, 0], material('#8d9691', .84, .24), .02)
  const fins: THREE.Mesh[] = []
  for (let i = 0; i < 34; i++) {
    const x = -1.5 + i * .09
    if (x > -.28 && x < .5) continue
    fins.push(box(g, [.028, .3, 1.42], [x, .02, 0], materials.fin, .004))
  }
  combine(g, fins, materials.fin)
  for (const z of [-.72, .72]) box(g, [3.15, .34, .11], [0, .02, z], materials.graphite, .02)
  for (const x of [-1.52, 1.52]) box(g, [.11, .34, 1.55], [x, .02, 0], materials.graphite, .02)
  for (const x of [-.16, .38]) box(g, [.1, .34, 1.5], [x, .02, 0], material('#6f7a74', .7, .35), .02)
  for (const y of [-.06, .12]) for (let i = 0; i < 3; i++) {
    const pipe = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.4, y, -.4 + i * .4), new THREE.Vector3(-.2, y + .07, -.4 + i * .4), new THREE.Vector3(1.4, y, -.4 + i * .4)])
    const m = new THREE.Mesh(new THREE.TubeGeometry(pipe, 20, .042, 8, false), materials.copper)
    m.castShadow = true; g.add(m)
  }
  const housing = box(g, [1.5, .08, 1.5], [-.85, -.2, 0], materials.graphite, .05)
  holeRect(housing)
  const lower = rotor(housing, 'lowerRotor', 11, .58, .07); lower.position.set(0, -.05, 0); lower.rotation.x = Math.PI
  torus(housing, .6, .022, [0, -.02, 0], materials.metal)
  for (const [x, z] of [[-1.45, -.68], [1.45, -.68], [-1.45, .68], [1.45, .68]]) screw(g, [x, .19, z], .04)
  box(g, [.13, .026, .15], [-1.5, .19, .66], materials.orange, .008)
  label(g, 'DUAL FLOW / HEAT SINK', [.4, .185, -.5], .9, '#8d968d')
}
function holeRect(mesh: THREE.Mesh) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .03, 8, 32), materials.ink)
  ring.rotation.x = -Math.PI / 2; ring.position.y = -.05; mesh.add(ring)
}
function fan(g: THREE.Group) {
  const plate = rect(3.35, 1.62, .12)
  hole(plate, .75, 0, .66)
  extrude(g, plate, .1, materials.graphite, [0, -.05, 0], [-Math.PI / 2, 0, 0])
  for (const z of [-.74, .74]) box(g, [3.2, .05, .1], [0, -.09, z], material('#22282a', .5, .5), .012)
  for (const x of [-1.56, 1.56]) box(g, [.1, .05, 1.5], [x, -.09, 0], material('#22282a', .5, .5), .012)
  torus(g, .66, .024, [.75, -.02, 0], materials.metal)
  const wheel = rotor(g, 'fanRotor', 11, .6, .07); wheel.position.set(.75, .02, 0)
  label(wheel, 'VOLTA', [0, .075, 0], .26, '#a8b2a8')
  const lightMat = new THREE.MeshStandardMaterial({ color: '#3d443f', emissive: '#86c8ea', emissiveIntensity: 0, roughness: .3, metalness: .4 })
  const bar = box(g, [.9, .03, .07], [-1.15, .02, .74], lightMat); bar.name = 'brandGlow'
  box(g, [.98, .045, .12], [-1.15, .005, .74], materials.ink, .01)
  label(g, 'V O L T A', [-1.15, .038, .74], .5, '#cfd6cd')
  const terminal = box(g, [.24, .12, .18], [-1.53, .1, .65], materials.cream, .012)
  terminal.name = 'fanTerminal'
  for (let i = 0; i < 4; i++) box(g, [.028, .06, .028], [-1.62 + i * .055, .16, .65], materials.gold, .003)
  box(g, [.09, .03, .12], [-1.53, .17, .52], materials.orange, .004)
  for (const [x, z] of [[-1.55, -.7], [1.55, -.7], [-1.55, .7], [1.55, .7]]) screw(g, [x, .05, z], .038)
}
export function createPart(id: 'pcb' | 'core' | 'heatsink' | 'fan') {
  const g = new THREE.Group(); g.userData.part = id
  ;({ pcb, core, heatsink, fan })[id](g)
  return g
}
