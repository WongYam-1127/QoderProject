import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ASSEMBLY, COLORS, DESK, DISPLAY, MOUNT, PARTS, PART_IDS, PORTS, PORT_IDS, SOLDER, WIRES, WIRE_IDS } from './config'
import { createProjection } from './projection'
import type { PartId, PortId, Vec3 } from './config'
import { lab, mountProblem, portAvailable } from './state'
import type { LabState } from './state'
import { box, createBase, createMonitor, createPart, createReflow, label, materials } from './models'
import { createPlatformPart } from './platform'
import { createDesk } from './desk'

const INTRO_ROTATIONS: Record<PartId, Vec3> = {
  board: [-.015, .1, .01], cpu: [.04, -.18, -.04], cooler: [-.05, .12, .03], dimmA: [.03, -.1, -.02],
  dimmB: [.03, .12, .02], shield: [-.02, .05, .04], psu: [-.04, -.12, .02],
  pcb: [-.02, .12, .012], core: [.05, -.2, -.05], heatsink: [-.07, .14, .05], fan: [.1, -.1, -.04]
}
const POWER_ANCHOR: Vec3 = [5.22, 2.42, -4.32]
const HEAT_ANCHOR: Vec3 = [SOLDER.head[0] + .04, SOLDER.head[1] + .46, SOLDER.head[2] + .34]
const DESK_MARKER = { desk: 'lamp', screen: 'screen', window: 'curtains' } as const

export class LabScene {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(38, 1, .1, 120)
  controls: OrbitControls
  projection: ReturnType<typeof createProjection>
  desk: ReturnType<typeof createDesk>
  workshop = new THREE.Group()
  cardGroup = new THREE.Group()
  platformGroup = new THREE.Group()
  cableGroup = new THREE.Group()
  internalGroup = new THREE.Group()
  parts = {} as Record<PartId, THREE.Group>
  targets = {} as Record<PartId, THREE.LineSegments>
  reflow = createReflow()
  rotors = { fan: null as THREE.Object3D | null, lower: null as THREE.Object3D | null, cooler: null as THREE.Object3D | null, exhaust: null as THREE.Object3D | null, intake: null as THREE.Object3D | null, psu: null as THREE.Object3D | null }
  leds: THREE.Mesh[] = []
  heatLight = new THREE.PointLight('#ff8a3c', 0, 3.2, 2)
  plateMaterial = new THREE.MeshStandardMaterial({ color: COLORS.desk, roughness: .94 })
  rim = new THREE.DirectionalLight('#fff2da', 0)
  ray = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  drag: { id: PartId; offset: THREE.Vector3; x: number; y: number; moved: boolean } | null = null
  cardDrag: { offset: THREE.Vector3; to: THREE.Vector3; x: number; y: number; moved: boolean } | null = null
  wireDrag: { id: PortId; x: number; y: number; moved: boolean } | null = null
  wireEnd = new THREE.Vector3()
  heatHold = false
  cableGhost: THREE.Mesh | null = null
  spin = 0
  fanRamp = 0
  ledRamp = 0
  frame = 0
  last = 0
  epoch = 0
  lastWires = ''
  lastPhase = ''
  lastView = -1
  disposed = false
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  mobile = matchMedia('(max-width: 700px), (pointer: coarse)').matches
  cameraTo = new THREE.Vector3()
  targetTo = new THREE.Vector3()
  cameraMoving = false
  lastSelection: PartId | null = null
  lastWire = ''
  lastSource: PortId | null = null
  lastGrabbable = false
  ambient = new THREE.HemisphereLight('#fff9ed', '#888b86', 1.5)
  sun = new THREE.DirectionalLight('#fff8e8', 2.1)
  onFrame?: (delta: number, time: number) => void
  onDispose?: () => void
  constructor(public host: HTMLDivElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 1.75))
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1
    this.renderer.setClearColor(COLORS.desk)
    host.prepend(this.renderer.domElement)
    const env = new RoomEnvironment(); const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envTarget = pmrem.fromScene(env, .04); this.scene.environment = envTarget.texture; this.scene.environmentIntensity = .4
    env.dispose(); pmrem.dispose()
    this.onDispose = () => envTarget.dispose()
    this.scene.background = new THREE.Color('#e5e1d6')
    this.scene.fog = new THREE.Fog('#e5e1d6', 26, 62)
    this.scene.add(this.ambient, this.sun)
    this.sun.position.set(-4, 11, 6); this.sun.castShadow = true
    this.sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048)
    this.sun.shadow.camera.left = -12; this.sun.shadow.camera.right = 12; this.sun.shadow.camera.top = 12; this.sun.shadow.camera.bottom = -12
    this.sun.shadow.normalBias = .025; this.sun.shadow.bias = -.00015; this.sun.shadow.blurSamples = 12
    const fill = new THREE.DirectionalLight('#e5eff1', 1.05); fill.position.set(6, 5, -6); this.scene.add(fill)
    this.rim.position.set(-6, 8, -7); this.scene.add(this.rim)
    this.heatLight.position.set(...SOLDER.head); this.scene.add(this.heatLight)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this.plateMaterial)
    plate.rotation.x = -Math.PI / 2; plate.receiveShadow = true; this.workshop.add(plate)
    const mat = new THREE.Group(); this.workshop.add(mat)
    const lineMat = new THREE.LineBasicMaterial({ color: '#a8ada0', transparent: true, opacity: .26 })
    const vertices: number[] = []
    for (let x = -6; x <= 6; x += .5) vertices.push(x, .004, -4.4, x, .004, 4.6)
    for (let z = -4; z <= 4; z += .5) vertices.push(-5.8, .004, z, 6.4, .004, z)
    mat.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)), lineMat))
    label(mat, 'VOLTA / GRAPHICS WORKSHOP', [-4.4, .006, 4.3], 2.6, '#797e72')
    label(mat, 'G01 — LOW VOLTAGE STUDY', [4.4, .006, -4.2], 2.4, '#797e72')
    for (const id of PART_IDS) {
      const [x, , z] = PARTS[id].home
      const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(PARTS[id].size[0] + .22, PARTS[id].size[2] + .22)), new THREE.LineDashedMaterial({ color: '#8b9284', dashSize: .12, gapSize: .09, transparent: true, opacity: .5 }))
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, .007, z); ring.computeLineDistances(); mat.add(ring)
    }
    const base = createBase()
    this.rigStand = base.getObjectByName('stand') || null
    this.scene.add(this.workshop, base, this.cableGroup)
    this.scene.add(createMonitor())
    this.scene.add(this.reflow)
    this.cardGroup.add(this.internalGroup)
    this.platformGroup.name = 'platform'
    this.scene.add(this.platformGroup)
    for (const id of PART_IDS) {
      const parent = PARTS[id].carrier === 'card' ? this.cardGroup : this.platformGroup
      const group = PARTS[id].carrier === 'card' ? createPart(id as 'pcb' | 'core' | 'heatsink' | 'fan') : createPlatformPart(id)
      group.position.set(...PARTS[id].exploded); this.parts[id] = group; parent.add(group)
      const target = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...PARTS[id].size)), new THREE.LineBasicMaterial({ color: COLORS.orange, transparent: true, opacity: .82, depthTest: false }))
      target.position.set(...PARTS[id].slot); target.visible = false; target.renderOrder = 10; this.targets[id] = target; parent.add(target)
    }
    this.scene.add(this.cardGroup)
    this.rotors.fan = this.find(this.parts.fan, 'fanRotor'); this.rotors.lower = this.find(this.parts.heatsink, 'lowerRotor')
    this.rotors.cooler = this.find(this.parts.cooler, 'coolerRotor'); this.rotors.psu = this.find(this.parts.psu, 'psuRotor')
    this.rotors.exhaust = this.find(base, 'caseRotor'); this.rotors.intake = this.find(base, 'intakeRotor')
    this.collectLeds()
    const canvas = this.renderer.domElement
    canvas.setAttribute('aria-label', '可交互的三维显卡装配工作台'); canvas.setAttribute('role', 'img')
    canvas.addEventListener('pointerdown', this.down, true)
    window.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.up)
    window.addEventListener('pointercancel', this.cancelPointer)
    window.addEventListener('keydown', this.key)
    host.addEventListener('pointerdown', this.portDown)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true; this.controls.dampingFactor = .075
    this.controls.minDistance = 5.5; this.controls.maxDistance = 30
    this.controls.minPolarAngle = .22; this.controls.maxPolarAngle = 1.4
    this.controls.enablePan = false; this.controls.touches.ONE = THREE.TOUCH.ROTATE; this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
    this.controls.addEventListener('start', this.stopCamera)
    this.resetCamera(true)
    window.addEventListener('resize', this.resize); this.resize()
    this.desk = createDesk(this.scene, this.reduced)
    this.projection = createProjection(this)
    this.onFrame = this.projection.update
    const disposeEnvironment = this.onDispose
    this.onDispose = () => { this.projection.dispose(); disposeEnvironment?.() }
    this.frame = requestAnimationFrame(this.animate)
    ;(window as unknown as { __VOLTA__: unknown }).__VOLTA__ = { read: () => this.diagnostics(), boxes: () => this.readBoxes(), parts: () => this.parts, scene: this.scene }
  }
  rigStand: THREE.Object3D | null = null
  ease(delta: number, rate: number) { return this.reduced ? 1 : 1 - Math.exp(-Math.max(delta, 0) * rate) }
  find(root: THREE.Object3D, name: string) { let hit: THREE.Object3D | null = null; root.traverse(o => { if (o.name === name) hit = o }); return hit }
  collectLeds() {
    this.scene.traverse(o => { if (o instanceof THREE.Mesh && /^(powerLed|monitorLed|brandGlow)$/.test(o.name)) this.leds.push(o) })
  }
  cardLocal(p: Vec3) { return this.cardGroup.localToWorld(new THREE.Vector3(...p)) }
  portPoint(id: PortId) {
    const port = PORTS[id]
    if (port.owner === 'external') return new THREE.Vector3(...port.local)
    const slot = PARTS[port.owner].slot
    return new THREE.Vector3(slot[0] + port.local[0], slot[1] + port.local[1], slot[2] + port.local[2])
  }
  portWorld(id: PortId) {
    const port = PORTS[id]
    return port.owner !== 'external' && PARTS[port.owner].carrier === 'card' ? this.cardGroup.localToWorld(this.portPoint(id)) : this.portPoint(id)
  }
  slotWorld(id: PartId, lift = .3) {
    const slot = PARTS[id].slot
    const point = new THREE.Vector3(slot[0], slot[1] + lift, slot[2])
    return PARTS[id].carrier === 'card' ? this.cardGroup.localToWorld(point) : point
  }
  resetCamera(immediate = false) {
    const s = lab.get(); const ratio = this.host.clientWidth / this.host.clientHeight; const narrow = ratio < .9
    const view = narrow ? 'mobile' : 'camera'
    if (s.phase === 'intro') {
      this.cameraTo.set(0, narrow ? 8.4 : 7.0, narrow ? -17.5 : -15.2); this.targetTo.set(0, narrow ? 3.6 : 3.3, -1.2)
    } else if (s.experience === 'cinema') {
      this.cameraTo.set(...DESK.cinema[view]); this.targetTo.set(...DESK.cinema.target)
    } else if (s.experience === 'desk') {
      const v = DESK.views[s.deskView]; this.cameraTo.set(...v[view]); this.targetTo.set(...(narrow ? v.mobileTarget : v.target))
    } else if (s.power !== 'off') {
      this.cameraTo.set(1.2, narrow ? 7.4 : 6.2, narrow ? -8.2 : -6.6); this.targetTo.set(1.2, 2.0, 2.4)
    } else if (s.card !== 'bench') {
      this.cameraTo.set(1.5, narrow ? 10.4 : 8.8, narrow ? -11.6 : -9.4); this.targetTo.set(1.7, 1.1, -1.5)
    } else {
      this.cameraTo.set(-.4, narrow ? 12.4 : 10.6, narrow ? -13.6 : -11.2); this.targetTo.set(-.2, 1.1, -.8)
    }
    this.camera.fov = s.phase === 'intro' ? narrow ? 46 : 34 : s.experience === 'desk' ? 52 : s.experience === 'cinema' ? 46 : s.power === 'off' ? 38 : 44
    this.camera.updateProjectionMatrix()
    if (immediate || this.reduced) { this.camera.position.copy(this.cameraTo); this.controls.target.copy(this.targetTo); this.cameraMoving = false }
    else this.cameraMoving = true
    this.controls.update()
  }
  portraitFraming(spread: number) {
    const reach = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.min(this.camera.aspect, 1)
    return THREE.MathUtils.clamp((spread / 2 + 1.2) / Math.max(reach, .05), 4.2, 16)
  }
  revealAt(point: THREE.Vector3, distance: number) {
    const aim = new THREE.Vector3().subVectors(this.cameraTo, this.targetTo).normalize()
    this.targetTo.copy(point).setY(point.y + .3)
    this.cameraTo.copy(this.targetTo).addScaledVector(aim, distance)
    this.cameraMoving = true
  }
  revealWire(a: PortId, b: PortId) {
    if (lab.get().power !== 'off') return
    const pa = this.portWorld(a), pb = this.portWorld(b)
    this.revealAt(pa.clone().add(pb).multiplyScalar(.5), this.portraitFraming(pa.distanceTo(pb)))
  }
  revealSlot(id: PartId) {
    const s = lab.get()
    if (s.experience !== 'bench' || s.power !== 'off' || s.card !== 'bench' || s.installed.includes(id)) return
    this.revealAt(this.slotWorld(id), 5.4)
  }
  stopCamera = () => { this.cameraMoving = false }
  resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight
    this.mobile = w < 700
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h)
    this.resetCamera(true)
  }
  setRay(x: number, y: number) {
    const b = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set((x - b.left) / b.width * 2 - 1, -(y - b.top) / b.height * 2 + 1)
    this.ray.setFromCamera(this.pointer, this.camera)
  }
  intersection(x: number, y: number, height: number) {
    this.setRay(x, y); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3())
  }
  down = (e: PointerEvent) => {
    const s = lab.get()
    if (e.button !== 0 || s.phase !== 'assembly') return
    this.setRay(e.clientX, e.clientY)
    const hits = this.ray.intersectObjects(this.scene.children, true)
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        if (obj.userData.control === 'heat') {
          if (s.card === 'bench') { this.heatHold = true; lab.heat(true); this.controls.enabled = false; this.cameraMoving = false; e.stopImmediatePropagation() }
          return
        }
        if (obj.userData.control === 'power') {
          if (s.experience !== 'bench') return
          if (this.cardReady(s) && s.card === 'bench') { this.liftCard(e); return }
          lab.power(); e.stopImmediatePropagation(); return
        }
        const id = obj.userData.part as PartId | undefined
        if (id) {
          if (s.power !== 'off' || s.experience !== 'bench') return
          if (this.cardReady(s) && s.card === 'bench') { this.liftCard(e); return }
          if (s.card !== 'bench') return
          if (s.selected !== id) lab.select(id)
          if (!s.installed.includes(id) && !s.seating && e.pointerType !== 'touch') {
            const point = this.intersection(e.clientX, e.clientY, PARTS[id].slot[1])
            if (point) this.drag = { id, offset: this.parts[id].position.clone().sub(point).setY(0), x: e.clientX, y: e.clientY, moved: false }
          }
          this.controls.enabled = false; this.cameraMoving = false; e.stopImmediatePropagation(); return
        }
        obj = obj.parent
      }
      if (hit.object instanceof THREE.Mesh) return
    }
  }
  cardReady(s = lab.get()) { return s.card === 'bench' && !mountProblem(s) }
  liftCard(e: PointerEvent) {
    const point = this.intersection(e.clientX, e.clientY, MOUNT.position[1])
    if (!point) return
    this.cardDrag = { offset: this.cardGroup.position.clone().sub(point), to: this.cardGroup.position.clone(), x: e.clientX, y: e.clientY, moved: false }
    this.controls.enabled = false; this.cameraMoving = false; lab.cancel(); e.stopImmediatePropagation()
  }
  portDown = (e: PointerEvent) => {
    const element = (e.target as HTMLElement).closest<HTMLElement>('[data-port]')
    if (!element || lab.get().power !== 'off') return
    const id = element.dataset.port as PortId
    if (lab.get().source && lab.get().source !== id) { lab.port(id); return }
    this.wireDrag = { id, x: e.clientX, y: e.clientY, moved: false }
    if (!lab.get().source) lab.port(id)
    this.wireEnd.copy(this.portWorld(id))
    this.controls.enabled = false; this.cameraMoving = false
    e.preventDefault()
  }
  move = (e: PointerEvent) => {
    if (this.wireDrag) {
      this.wireDrag.moved ||= Math.hypot(e.clientX - this.wireDrag.x, e.clientY - this.wireDrag.y) > 8
      const p = this.intersection(e.clientX, e.clientY, Math.max(.6, MOUNT.position[1])); if (p) this.wireEnd.copy(p)
    }
    if (this.cardDrag) {
      this.cardDrag.moved ||= Math.hypot(e.clientX - this.cardDrag.x, e.clientY - this.cardDrag.y) > 6
      const point = this.intersection(e.clientX, e.clientY, MOUNT.position[1])
      if (point && this.cardDrag.moved) this.cardDrag.to.copy(point.add(this.cardDrag.offset)).setY(MOUNT.position[1])
      this.renderer.domElement.style.cursor = 'grabbing'; return
    }
    if (!this.drag) return
    this.drag.moved ||= Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 6
    const point = this.intersection(e.clientX, e.clientY, PARTS[this.drag.id].slot[1])
    if (point && this.drag.moved) this.parts[this.drag.id].position.copy(point.add(this.drag.offset))
    this.renderer.domElement.style.cursor = 'grabbing'
  }
  up = (e: PointerEvent) => {
    if (this.wireDrag?.moved) {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-port]')
      if (target) lab.connect(this.wireDrag.id, target.dataset.port as PortId)
      else lab.cancel()
    }
    if (this.cardDrag?.moved) lab.attemptMount(this.cardGroup.position.toArray() as Vec3)
    if (this.drag?.moved) lab.attempt(this.drag.id, this.parts[this.drag.id].position.toArray() as Vec3)
    if (this.heatHold) { this.heatHold = false; lab.heat(false) }
    this.drag = null; this.cardDrag = null; this.wireDrag = null; this.controls.enabled = true; this.renderer.domElement.style.cursor = ''
  }
  cancelPointer = () => {
    if (this.heatHold) { this.heatHold = false; lab.heat(false) }
    this.drag = null; this.cardDrag = null; this.wireDrag = null; this.controls.enabled = true; lab.cancel()
  }
  key = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).matches('input, textarea, select')) return
    const s = lab.get()
    if (s.experience === 'desk' && ['a', 'A', 'ArrowLeft'].includes(e.key)) lab.deskMove(-1)
    else if (s.experience === 'desk' && ['d', 'D', 'ArrowRight'].includes(e.key)) lab.deskMove(1)
    else if (s.experience === 'desk' && e.key === 'Enter') lab.cinema()
    else if (s.experience === 'cinema' && e.key === 'Escape') lab.leaveCinema()
    else if (s.experience === 'desk' && e.key === 'Escape') lab.leaveDesk()
    else if (e.key.toLowerCase() === 'r') lab.rotate()
    else if (e.key === 'Escape') this.cancelPointer()
  }
  project(position: THREE.Vector3) {
    const p = position.clone().project(this.camera)
    return { x: (p.x + 1) * this.host.clientWidth / 2, y: (-p.y + 1) * this.host.clientHeight / 2, visible: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 }
  }
  anchor(name: string): THREE.Vector3 {
    if (name.startsWith('part:')) { const id = name.slice(5) as PartId; return this.parts[id].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .42, 0)) }
    if (name.startsWith('slot:')) return this.slotWorld(name.slice(5) as PartId)
    if (name.startsWith('port:')) return this.portWorld(name.slice(5) as PortId)
    if (name.startsWith('desk:')) return new THREE.Vector3(...DESK.anchors[name.slice(5) as keyof typeof DESK.anchors])
    if (name === 'power') return new THREE.Vector3(...POWER_ANCHOR)
    if (name === 'heat') return new THREE.Vector3(...HEAT_ANCHOR)
    if (name === 'mount') return new THREE.Vector3(MOUNT.slot[0], MOUNT.slot[1] + .42, MOUNT.slot[2])
    if (name === 'screen') return new THREE.Vector3(DISPLAY.panel[0], DISPLAY.panel[1], DISPLAY.panel[2] - .4)
    if (name === 'card') return this.cardLocal([MOUNT.grip[0], MOUNT.grip[1] + .55, MOUNT.grip[2]])
    return new THREE.Vector3(0, 1.4, 0)
  }
  updateLabels() {
    const s = lab.get()
    const bench = s.experience === 'bench'
    this.host.querySelectorAll<HTMLElement>('[data-anchor]').forEach(el => {
      const name = el.dataset.anchor!; const point = this.project(this.anchor(name))
      const port = name.startsWith('port:') ? name.slice(5) as PortId : null
      const part = name.startsWith('part:') ? name.slice(5) as PartId : null
      const slot = name.startsWith('slot:') ? name.slice(5) as PartId : null
      const marker = name.startsWith('desk:') ? name.slice(5) : null
      let visible = point.visible && s.phase === 'assembly'
      if (port) visible &&= bench && (s.mode === 'wires' || s.hint === port) && portAvailable(s, port) && s.power === 'off'
      if (part) visible &&= bench && s.mode === 'parts' && s.card === 'bench' && !this.cardReady(s) && !s.installed.includes(part) && !s.seating && s.power === 'off'
      if (slot) visible &&= bench && (s.selected === slot || s.hint === slot) && !s.installed.includes(slot) && !s.seating && s.power === 'off'
      if (name === 'heat') visible &&= bench && s.card === 'bench' && s.installed.includes('core') && !s.soldered && s.power === 'off'
      if (name === 'mount') visible &&= bench && s.card === 'bench' && this.cardReady(s)
      if (name === 'card') visible &&= bench && s.card === 'mounted' && s.power === 'off' && s.mode !== 'wires'
      if (name === 'power') visible &&= bench && s.power === 'off' && s.card === 'mounted' && s.mode !== 'wires'
      if (name === 'screen') visible &&= bench && s.power === 'on'
      if (marker) visible &&= s.experience === 'desk' && marker === DESK_MARKER[s.deskView]
      el.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px) translate(-50%, -50%)`
      el.style.visibility = visible ? 'visible' : 'hidden'
    })
  }
  makeCable(points: Vec3[], color: string, radius = .042) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 7, false), new THREE.MeshStandardMaterial({ color, roughness: .72 }))
    mesh.castShadow = true; return mesh
  }
  rebuildCables() {
    const clear = (group: THREE.Group) => {
      group.children.forEach(o => { const m = o as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose() })
      group.clear()
    }
    clear(this.cableGroup); clear(this.internalGroup)
    for (const id of lab.get().wires) {
      const wire = WIRES[id]
      const at = (end: PortId) => wire.internal ? this.portPoint(end) : this.portWorld(end)
      const points = [at(wire.ends[0]).toArray() as Vec3, ...wire.route, at(wire.ends[1]).toArray() as Vec3]
      ;(wire.internal ? this.internalGroup : this.cableGroup).add(this.makeCable(points, wire.color))
    }
  }
  animate = (time: number) => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.animate)
    if (document.hidden) { this.last = time; return }
    if (!this.drag && !this.cardDrag && !this.wireDrag && time - this.last < 30) return
    const raw = Math.max(0, (time - (this.last || time)) / 1000); this.last = time
    const delta = Math.min(raw, .05)
    const s = lab.get()
    if (s.epoch !== this.epoch) {
      this.epoch = s.epoch; this.cancelPointer()
      PART_IDS.forEach(id => this.parts[id].position.set(...PARTS[id].exploded))
      this.cardGroup.position.set(0, 0, 0); this.cardGroup.rotation.set(0, 0, 0)
      this.lastPhase = ''; this.spin = 0; this.fanRamp = 0; this.ledRamp = 0; this.reflow.position.set(...SOLDER.head)
    }
    lab.tick(raw)
    const phaseKey = `${s.phase}:${s.power}:${s.experience}:${s.deskView}:${s.card}:${s.installed.length}:${s.soldered}`
    if (phaseKey !== this.lastPhase || s.viewVersion !== this.lastView) { this.lastPhase = phaseKey; this.lastView = s.viewVersion; this.resetCamera() }
    if (s.selected !== this.lastSelection) { this.lastSelection = s.selected; if (s.selected && this.host.clientWidth / this.host.clientHeight < .9) this.revealSlot(s.selected) }
    const pendingId = s.mode === 'wires' && s.experience === 'bench' ? WIRE_IDS.find(id => !s.wires.includes(id) && WIRES[id].internal === (s.card === 'bench')) : undefined
    const wireKey = pendingId ? `${s.mode}:${pendingId}` : ''
    if (wireKey !== this.lastWire) { this.lastWire = wireKey; if (pendingId && this.host.clientWidth / this.host.clientHeight < .9) this.revealWire(...WIRES[pendingId].ends) }
    if (s.source !== this.lastSource) {
      this.lastSource = s.source
      const other = s.source ? WIRE_IDS.find(id => !s.wires.includes(id) && WIRES[id].ends.includes(s.source!)) : undefined
      if (other && this.host.clientWidth / this.host.clientHeight < .9) this.revealAt(this.portWorld(WIRES[other].ends.find(end => end !== s.source)!), 4.6)
    }
    const grabbable = s.experience === 'bench' && s.power === 'off' && s.card === 'bench' && this.cardReady(s)
    if (grabbable !== this.lastGrabbable) { this.lastGrabbable = grabbable; if (grabbable && this.host.clientWidth / this.host.clientHeight < .9) this.revealAt(this.anchor('mount'), this.portraitFraming(2.6)) }
    const desk = s.experience !== 'bench'
    this.workshop.visible = !desk
    if (this.rigStand) this.rigStand.visible = !desk
    this.reflow.visible = !desk && s.phase === 'assembly' && s.card === 'bench' && s.installed.includes('core') && !s.soldered
    this.rim.intensity = s.phase === 'intro' ? 1.7 : 0
    this.scene.environmentIntensity = s.phase === 'intro' ? .58 : desk ? .3 : .4
    this.desk.update(s, delta)
    if (!this.drag && !this.cardDrag && !this.wireDrag && !this.heatHold) this.controls.enabled = !desk && s.phase !== 'intro'
    if (this.cameraMoving) {
      const k = this.ease( delta, 3.6)
      this.camera.position.lerp(this.cameraTo, k); this.controls.target.lerp(this.targetTo, k)
      if (this.camera.position.distanceTo(this.cameraTo) < .025) this.cameraMoving = false
    }
    this.plateMaterial.color.lerp(new THREE.Color(desk ? '#8d6f57' : COLORS.desk), this.ease( delta, 3))
    this.updateCard(s, delta)
    let settled = true
    for (const id of PART_IDS) {
      const part = this.parts[id], installed = s.installed.includes(id) || s.seating === id
      const destination = new THREE.Vector3(...(s.phase === 'intro' ? PARTS[id].exploded : installed ? PARTS[id].slot : PARTS[id].home))
      if (s.phase === 'intro' && !this.reduced) destination.y += Math.sin(time / 1500 + PART_IDS.indexOf(id) * .9) * .05
      const k = this.ease( delta, 10)
      if (this.drag?.id !== id || !this.drag.moved) part.position.lerp(destination, k)
      part.rotation.x = THREE.MathUtils.lerp(part.rotation.x, s.phase === 'intro' ? INTRO_ROTATIONS[id][0] : 0, k)
      part.rotation.y = s.phase === 'intro' ? INTRO_ROTATIONS[id][1] : installed ? ASSEMBLY.targetAngle : s.angles[id]
      part.rotation.z = THREE.MathUtils.lerp(part.rotation.z, s.phase === 'intro' ? INTRO_ROTATIONS[id][2] : 0, k)
      if (part.position.distanceTo(destination) > .015) settled = false
      if (s.seating === id && part.position.distanceTo(destination) < .015) lab.seated(id, s.epoch)
      this.targets[id].visible = s.phase === 'assembly' && s.experience === 'bench' && !installed && (s.selected === id || s.hint === id) && s.power === 'off' && s.card === 'bench'
    }
    if (s.phase === 'arranging' && settled) lab.arranged()
    this.updateHeat(s, delta, time)
    this.updateMotion(s, delta)
    const wires = s.wires.join(','); if (wires !== this.lastWires) { this.lastWires = wires; this.rebuildCables() }
    if (this.cableGhost) { this.cableGhost.geometry.dispose(); (this.cableGhost.material as THREE.Material).dispose(); this.cableGhost.removeFromParent(); this.cableGhost = null }
    if (this.wireDrag?.moved && s.source) {
      const start = this.portWorld(this.wireDrag.id), end = this.wireEnd
      this.cableGhost = this.makeCable([start.toArray(), [start.x, start.y + .3, start.z], [(start.x + end.x) / 2, Math.max(start.y, end.y) + .2, (start.z + end.z) / 2], end.toArray()], COLORS.orange, .026)
      this.scene.add(this.cableGhost)
    }
    this.controls.enableDamping = !desk
    this.controls.update(); this.updateLabels(); this.onFrame?.(Math.min(raw, .5), time / 1000)
    if (s.phase === 'intro') { this.ambient.intensity = 1; this.sun.intensity = 3.1 }
    this.renderer.render(this.scene, this.camera)
  }
  updateCard(s: LabState, delta: number) {
    const k = this.ease( delta, 6)
    if (this.cardDrag) { this.cardGroup.position.lerp(this.cardDrag.to, 1 - Math.exp(-delta * 12)); return }
    const mounted = s.card === 'mounted' || s.card === 'seating'
    this.cardGroup.position.lerp(new THREE.Vector3(...(mounted ? MOUNT.position : [0, 0, 0])), mounted ? k : 1 - Math.exp(-delta * 7))
    const seated = this.cardGroup.position.distanceTo(new THREE.Vector3(...MOUNT.position)) < .14
    const kr = 1 - Math.exp(-delta * (mounted && seated ? 4.6 : 1))
    this.cardGroup.rotation.x = THREE.MathUtils.lerp(this.cardGroup.rotation.x, mounted && seated ? MOUNT.rotation[0] : 0, kr)
    if (s.card === 'seating' && seated && Math.abs(this.cardGroup.rotation.x - MOUNT.rotation[0]) < .02) lab.mounted(s.epoch)
  }
  updateHeat(s: LabState, delta: number, time: number) {
    const k = this.ease( delta, 8)
    const heat = Math.max(0, Math.min(1, (s.temp - SOLDER.ambient) / (SOLDER.ceiling - SOLDER.ambient)))
    const hot = s.temp > SOLDER.ceiling
    const coil = this.reflow.getObjectByName('heatCoil') as THREE.Mesh | undefined
    if (coil) (coil.material as THREE.MeshStandardMaterial).emissiveIntensity = THREE.MathUtils.lerp((coil.material as THREE.MeshStandardMaterial).emissiveIntensity, heat * (hot ? 3.4 + Math.sin(time / 90) * .8 : 2.4), k)
    materials.solder.emissiveIntensity = THREE.MathUtils.lerp(materials.solder.emissiveIntensity, s.soldered ? .1 : heat * heat * 1.9, k)
    this.heatLight.intensity = THREE.MathUtils.lerp(this.heatLight.intensity, heat * 2.4 * (s.heating ? 1 : .5), k)
    const drop = (s.heating ? .16 : 0) + (s.soldered ? .04 : 0)
    this.reflow.position.y = THREE.MathUtils.lerp(this.reflow.position.y, SOLDER.head[1] - drop, k)
  }
  updateMotion(s: LabState, delta: number) {
    const target = s.power === 'on' ? 1 : s.power === 'booting' ? .55 : 0
    this.fanRamp = THREE.MathUtils.lerp(this.fanRamp, target, 1 - Math.exp(-delta * (s.power === 'off' ? 1.4 : 1.1)))
    this.spin += delta * this.fanRamp * 13
    const spin = (rotor: THREE.Object3D | null, rate: number) => { if (rotor) rotor.rotation.y = this.spin * rate }
    spin(this.rotors.fan, 1); spin(this.rotors.lower, -.92); spin(this.rotors.cooler, .78)
    spin(this.rotors.psu, .5); spin(this.rotors.exhaust, -.62); spin(this.rotors.intake, .55)
    const ledTarget = s.power === 'off' ? 0 : s.power === 'booting' ? .35 : 1
    this.ledRamp = THREE.MathUtils.lerp(this.ledRamp, ledTarget, 1 - Math.exp(-delta * 2.2))
    for (const led of this.leds) {
      const material = led.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = this.ledRamp * (led.name === 'brandGlow' ? 1.6 : 1.2)
    }
  }
  readBoxes() {
    const out: Record<string, { center: number[]; size: number[] }> = {}
    this.scene.traverse(o => {
      if (!o.name) return
      const b = new THREE.Box3().setFromObject(o)
      if (b.isEmpty()) return
      out[o.name] = { center: b.getCenter(new THREE.Vector3()).toArray(), size: b.getSize(new THREE.Vector3()).toArray() }
    })
    return out
  }
  diagnostics() {
    const s = lab.get()
    const grip = this.cardLocal(MOUNT.grip)
    return {
      state: structuredClone(s), reduced: this.reduced, projection: this.projection.read(), desk: this.desk.read(),
      card: { transform: this.cardGroup.position.toArray(), rotation: this.cardGroup.rotation.toArray().slice(0, 3), screen: this.project(grip), ready: this.cardReady(s), mountTarget: this.project(new THREE.Vector3(...MOUNT.position)) },
      parts: Object.fromEntries(PART_IDS.map(id => [id, { world: this.parts[id].getWorldPosition(new THREE.Vector3()).toArray(), screen: this.project(this.parts[id].getWorldPosition(new THREE.Vector3())), slot: this.project(this.anchor(`slot:${id}`)), slotWorld: PARTS[id].slot, angle: this.parts[id].rotation.y, targetVisible: this.targets[id].visible }])),
      ports: Object.fromEntries(PORT_IDS.map(id => [id, { screen: this.project(this.portWorld(id)), world: this.portWorld(id).toArray(), available: portAvailable(s, id) }])),
      wires: WIRE_IDS.map(id => ({ id, connected: s.wires.includes(id), internal: WIRES[id].internal })),
      heat: { head: this.project(this.anchor('heat')), visible: this.reflow.visible, temp: s.temp, reflow: s.reflow },
      screenCorners: ([[1, 1], [1, -1], [-1, -1], [-1, 1]] as const).map(([sx, sy]) => this.project(new THREE.Vector3(DISPLAY.panel[0] - sx * DISPLAY.width / 2, DISPLAY.panel[1] + sy * DISPLAY.height / 2, DISPLAY.panel[2]))),
      labels: Object.fromEntries(Array.from(this.host.querySelectorAll<HTMLElement>('[data-anchor]')).map(el => [el.dataset.anchor, el.style.visibility === 'visible'])),
      drag: this.drag ? { id: this.drag.id, moved: this.drag.moved, drop: this.project(new THREE.Vector3(...PARTS[this.drag.id].slot).sub(this.drag.offset)) } : null,
      cardDrag: this.cardDrag ? { moved: this.cardDrag.moved, to: this.cardDrag.to.toArray() } : null,
      camera: { position: this.camera.position.toArray(), target: this.controls.target.toArray(), enabled: this.controls.enabled, fov: this.camera.fov },
      drawCalls: this.renderer.info.render.calls
    }
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame)
    window.removeEventListener('resize', this.resize); window.removeEventListener('pointermove', this.move); window.removeEventListener('pointerup', this.up); window.removeEventListener('pointercancel', this.cancelPointer); window.removeEventListener('keydown', this.key)
    this.host.removeEventListener('pointerdown', this.portDown); this.renderer.domElement.removeEventListener('pointerdown', this.down, true)
    this.controls.dispose(); this.onDispose?.(); this.desk.dispose()
    const textures = new Set<THREE.Texture>()
    this.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return
      o.geometry.dispose()
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      mats.forEach(m => { Object.values(m).forEach(value => { if (value instanceof THREE.Texture) textures.add(value) }); m.dispose() })
    })
    textures.forEach(texture => texture.dispose())
    this.renderer.dispose(); this.renderer.domElement.remove()
  }
}
