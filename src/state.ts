import { ASSEMBLY, BRAND, COPY, GRAPHICS_IDS, MOUNT, PARTS, PART_IDS, PORTS, SOLDER, WIRES, WIRE_IDS } from './config.ts'
import type { Content, DeskView, PartId, PortId, Vec3, WireId } from './config.ts'
export type Phase = 'intro' | 'arranging' | 'assembly'
export type Power = 'off' | 'booting' | 'on'
export type Experience = 'bench' | 'desk' | 'cinema'
export type CardState = 'bench' | 'seating' | 'mounted'
export const PROGRESS_TOTAL = PART_IDS.length + WIRE_IDS.length + 2
type Notice = { title: string; detail: string; kind: 'info' | 'success' | 'error' }
export const initialState = (epoch = 0) => ({
  phase: 'intro' as Phase, installed: [] as PartId[], seating: null as PartId | null, angles: Object.fromEntries(PART_IDS.map(id => [id, PARTS[id].initialAngle])) as Record<PartId, number>,
  wires: [] as WireId[], selected: null as PartId | null, source: null as PortId | null, power: 'off' as Power,
  card: 'bench' as CardState, heating: false, temp: SOLDER.ambient, reflow: 0, soldered: false, scorches: 0,
  brightness: 78, contrast: 52, sharpness: 54, content: 'film' as Content, playing: false, sound: false,
  mode: 'parts' as 'parts' | 'wires', hint: null as PartId | PortId | null, viewVersion: 0, epoch,
  experience: 'bench' as Experience, deskView: 'screen' as DeskView, lampOn: true, curtainsOpen: true,
  notice: { title: COPY.feedback.initial.title, detail: COPY.feedback.initial.detail, kind: 'info' } as Notice, mediaError: false
})
export type LabState = ReturnType<typeof initialState>
export function installationProblem(state: LabState, id: PartId): string | null {
  if (state.power !== 'off') return COPY.rules.installation.powered
  if (state.installed.includes(id)) return COPY.rules.installation.installed
  if (state.seating) return COPY.rules.installation.seating
  if (state.card !== 'bench') return COPY.rules.installation.mounted
  const missing = PARTS[id].dependencies.filter(p => !state.installed.includes(p))
  if (missing.length) return COPY.rules.installation.dependencies(missing.map(p => PARTS[p].name))
  if (id === 'heatsink' && !state.soldered) return COPY.rules.installation.unsoldered
  return null
}
export function placementProblem(state: LabState, id: PartId, position: Vec3): string | null {
  const issue = installationProblem(state, id)
  if (issue) return issue
  const d = Math.hypot(...position.map((v, i) => v - PARTS[id].slot[i]))
  if (d > ASSEMBLY.snapDistance) return COPY.rules.placement.slot
  const angle = (((state.angles[id] - ASSEMBLY.targetAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  if (Math.min(angle, Math.PI * 2 - angle) > ASSEMBLY.angleTolerance) return COPY.rules.placement.angle
  return null
}
export function mountProblem(state: LabState): string | null {
  if (state.power !== 'off') return COPY.rules.installation.powered
  if (state.card !== 'bench') return COPY.rules.installation.mounted
  const missing = GRAPHICS_IDS.filter(id => !state.installed.includes(id))
  if (missing.length) return COPY.rules.mounting.incomplete(COPY.mount.needParts)
  if (!state.soldered) return COPY.rules.mounting.incomplete(COPY.mount.needSolder)
  if (!state.wires.includes('fan')) return COPY.rules.mounting.incomplete(COPY.mount.needFanWire)
  if (!state.installed.includes('board')) return COPY.rules.mounting.incomplete(COPY.mount.needBoard)
  return null
}
export function portAvailable(s: LabState, id: PortId): boolean {
  const port = PORTS[id]
  if (port.owner === 'external') return true
  if (!s.installed.includes(port.owner)) return false
  if (port.when === 'bench') return s.card === 'bench'
  if (port.when === 'mounted') return s.card === 'mounted'
  return true
}
export function connectionProblem(s: LabState, a: PortId, b: PortId): string | null {
  if (s.power !== 'off') return COPY.rules.connection.powered
  if (a === b) return COPY.rules.connection.samePort
  if (!portAvailable(s, a) || !portAvailable(s, b)) return COPY.rules.connection.unavailable
  if (!WIRE_IDS.some(id => WIRES[id].ends.includes(a) && WIRES[id].ends.includes(b))) return COPY.rules.connection.incompatible(a, b)
  if (s.wires.some(id => WIRES[id].ends.includes(a) || WIRES[id].ends.includes(b))) return COPY.rules.connection.connected
  return null
}
export function missingPower(s: LabState): { label: string; target: PartId | PortId }[] {
  const items: { label: string; target: PartId | PortId }[] = PART_IDS.filter(id => !s.installed.includes(id)).map(id => ({ label: COPY.rules.power.install(PARTS[id].name), target: id }))
  if (!s.soldered) items.push({ label: COPY.rules.power.solder, target: 'core' })
  for (const id of WIRE_IDS.filter(id => !s.wires.includes(id))) {
    const target = WIRES[id].ends.find(p => PORTS[p].owner === 'external') || WIRES[id].ends[0]
    items.push({ label: COPY.rules.power.connect(id), target })
  }
  if (s.card !== 'mounted') items.push({ label: COPY.rules.power.mount, target: 'pcb' })
  return items
}
export function step(s: LabState) {
  if (s.power !== 'off') return { index: 6, ...COPY.steps.projecting }
  if (s.card === 'mounted') return { index: 5, ...COPY.steps.power }
  if (s.soldered) return { index: 4, ...COPY.steps.wiring }
  if (s.installed.includes('core')) return { index: 3, ...COPY.steps.soldering }
  if (s.installed.includes('pcb')) return { index: 2, ...COPY.steps.assembly }
  return { index: 1, ...COPY.steps.platform }
}
export function progress(s: LabState) { return s.installed.length + (s.soldered ? 1 : 0) + s.wires.length + (s.card === 'mounted' ? 1 : 0) }
let state = initialState()
const listeners = new Set<() => void>()
const emit = (patch: Partial<LabState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
const tell = (title: string, detail = '', kind: LabState['notice']['kind'] = 'info') => emit({ notice: { title, detail, kind } })
const heatAllowed = (s: LabState) => s.phase === 'assembly' && s.power === 'off' && s.card === 'bench' && s.installed.includes('core') && !s.soldered && !s.seating
export const lab = {
  get: () => state,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
  start: () => emit({ phase: 'arranging', hint: null, selected: null }),
  arranged: () => { if (state.phase === 'arranging') emit({ phase: 'assembly' }) },
  select(id: PartId) {
    if (state.phase !== 'assembly') return
    if (state.power !== 'off') return tell(COPY.feedback.assemblyLocked.title, COPY.feedback.assemblyLocked.detail, 'error')
    if (state.seating || state.card !== 'bench') return
    emit({ selected: state.selected === id ? null : id, source: null, mode: 'parts', hint: id })
    tell(PARTS[id].name, state.installed.includes(id) ? COPY.feedback.installed : PARTS[id].description)
  },
  rotate() {
    const id = state.selected
    if (!id || state.installed.includes(id) || state.seating || state.power !== 'off' || state.card !== 'bench') return
    emit({ angles: { ...state.angles, [id]: (state.angles[id] + Math.PI / 2) % (Math.PI * 2) } })
    tell(COPY.feedback.rotated.title, COPY.feedback.rotated.detail)
  },
  attempt(id: PartId, position: Vec3) {
    if (state.phase !== 'assembly') return false
    const issue = placementProblem(state, id, position)
    if (issue) { emit({ selected: id, hint: id }); tell(COPY.feedback.placementFailed, issue, 'error'); return false }
    emit({ seating: id, selected: null, hint: null })
    tell(COPY.feedback.seating, PARTS[id].name)
    return true
  },
  seated(id: PartId, epoch: number) {
    if (epoch !== state.epoch || state.seating !== id) return
    emit({ installed: [...state.installed, id], seating: null })
    tell(COPY.feedback.seated.title(PARTS[id].name), id === 'core' ? COPY.feedback.seated.core : id === 'cpu' ? COPY.feedback.seated.cpu : id === 'board' ? COPY.feedback.seated.board : COPY.feedback.seated.detail, 'success')
  },
  remove(id: PartId) {
    if (state.power !== 'off') return tell(COPY.feedback.assemblyLocked.title, COPY.feedback.removalPowered, 'error')
    if (!state.installed.includes(id)) return
    if (state.card === 'mounted' && id === 'board') return tell(COPY.feedback.removeDependent.title, COPY.rules.installation.boardRemoved, 'error')
    if (state.card !== 'bench') return tell(COPY.feedback.unmount.title, COPY.feedback.unmount.detail, 'error')
    const wire = state.wires.find(w => WIRES[w].internal && WIRES[w].ends.some(p => PORTS[p].owner === id))
    if (wire) return tell(COPY.feedback.disconnectFirst.title, COPY.feedback.disconnectFirst.detail(WIRES[wire].name, PARTS[id].name), 'error')
    const dependent = state.installed.find(p => PARTS[p].dependencies.includes(id))
    if (dependent) return tell(COPY.feedback.removeDependent.title, COPY.feedback.removeDependent.detail(PARTS[dependent].name), 'error')
    emit({ installed: state.installed.filter(p => p !== id), selected: id, hint: id, soldered: id === 'core' ? false : state.soldered, reflow: id === 'core' ? 0 : state.reflow })
    tell(COPY.feedback.removed.title(PARTS[id].name), id === 'core' ? COPY.solder.locked : COPY.feedback.removed.detail)
  },
  mode(mode: LabState['mode']) { emit({ mode, source: null, selected: null, hint: null }) },
  heat(on: boolean) {
    if (!on) { if (state.heating) emit({ heating: false }); return }
    if (state.power !== 'off') return tell(COPY.feedback.assemblyLocked.title, COPY.feedback.assemblyLocked.detail, 'error')
    if (state.soldered) return tell(COPY.solder.finish, COPY.feedback.soldered.already)
    if (state.card !== 'bench') return tell(COPY.rules.installation.mounted, COPY.feedback.unmount.detail, 'error')
    if (!state.installed.includes('core')) return tell(COPY.feedback.placementFailed, COPY.solder.noCore, 'error')
    if (state.seating) return
    emit({ heating: true, selected: null, hint: null })
    tell(COPY.solder.title, COPY.solder.heating)
  },
  tick(elapsed: number) {
    let left = Math.max(0, Math.min(elapsed, .5))
    while (left > 0) {
      const dt = Math.min(left, .05); left -= dt
      const s = state
      if (s.heating && !heatAllowed(s)) { emit({ heating: false }); return }
      if (!s.heating && s.temp <= SOLDER.ambient + .5) return
      const temp = Math.max(SOLDER.ambient, Math.min(SOLDER.max, s.heating
        ? s.temp + (SOLDER.ramp - (s.temp - SOLDER.ambient) * SOLDER.cooling) * dt
        : s.temp - ((s.temp - SOLDER.ambient) * SOLDER.cooling + SOLDER.drift) * dt))
      const inWindow = temp >= SOLDER.target && temp <= SOLDER.ceiling
      const hot = temp > SOLDER.ceiling
      const reflow = Math.max(0, Math.min(100, s.reflow + (inWindow ? 100 / SOLDER.dwell * dt : hot ? -SOLDER.overheat * dt : 0)))
      const soldered = reflow >= 100
      if (!soldered && Math.round(temp) === Math.round(s.temp) && Math.round(reflow) === Math.round(s.reflow)) continue
      const patch: Partial<LabState> = { temp, reflow, soldered }
      if (soldered) patch.heating = false
      if (hot && s.temp <= SOLDER.ceiling) { patch.scorches = s.scorches + 1; patch.heating = false }
      emit(patch)
      if (soldered && !s.soldered) tell(COPY.solder.finish, COPY.solder.done, 'success')
      else if (hot && s.temp <= SOLDER.ceiling) tell(COPY.feedback.overheated.title, COPY.feedback.overheated.detail, 'error')
      else if (inWindow && !(s.temp >= SOLDER.target)) tell(COPY.solder.reflow, COPY.solder.window, 'info')
    }
  },
  attemptMount(position: Vec3) {
    const issue = mountProblem(state)
    if (issue) { tell(COPY.feedback.mountBlocked.title, issue, 'error'); return false }
    const d = Math.hypot(...position.map((v, i) => v - MOUNT.position[i]))
    if (d > ASSEMBLY.mountSnapDistance) { emit({ hint: null }); tell(COPY.feedback.placementFailed, COPY.rules.mounting.distance, 'error'); return false }
    emit({ card: 'seating', selected: null, hint: null })
    tell(COPY.feedback.seating, COPY.mount.dragging)
    return true
  },
  mounted(epoch: number) {
    if (epoch !== state.epoch || state.card !== 'seating') return
    emit({ card: 'mounted' })
    tell(COPY.feedback.mounted.title, COPY.feedback.mounted.detail, 'success')
  },
  unmount() {
    if (state.power !== 'off') return tell(COPY.feedback.assemblyLocked.title, COPY.feedback.removalPowered, 'error')
    if (state.card !== 'mounted') return
    const external = state.wires.find(w => WIRES[w].ends.some(p => PORTS[p].when === 'mounted'))
    if (external) return tell(COPY.feedback.disconnectFirst.title, COPY.feedback.disconnectFirst.detail(WIRES[external].name, BRAND.card), 'error')
    emit({ card: 'bench', selected: 'pcb', hint: 'pcb' })
    tell(COPY.feedback.unmounted.title, COPY.feedback.unmounted.detail)
  },
  port(id: PortId) {
    if (state.power !== 'off') return tell(COPY.feedback.shutdownFirst, COPY.feedback.wiresLocked, 'error')
    if (!portAvailable(state, id)) return tell(COPY.feedback.portUnavailable.title, COPY.feedback.portUnavailable.detail, 'error')
    if (state.source) return lab.connect(state.source, id)
    emit({ source: id, selected: null, mode: 'wires', hint: null })
    tell(COPY.feedback.portSelected.title(id), COPY.feedback.portSelected.detail)
  },
  connect(a: PortId, b: PortId) {
    const issue = connectionProblem(state, a, b)
    if (issue) { tell(COPY.feedback.connectionFailed, issue, 'error'); emit({ source: null }); return false }
    const id = WIRE_IDS.find(w => WIRES[w].ends.includes(a) && WIRES[w].ends.includes(b))!
    emit({ wires: [...state.wires, id], source: null, hint: null })
    tell(COPY.feedback.connected(a, b), WIRES[id].name, 'success')
    return true
  },
  disconnect(id: WireId) {
    if (state.power !== 'off') return tell(COPY.feedback.shutdownFirst, COPY.feedback.disconnectPowered, 'error')
    if (WIRES[id].internal && state.card !== 'bench') return tell(COPY.feedback.mountFirst.title, COPY.feedback.mountFirst.detail, 'error')
    emit({ wires: state.wires.filter(w => w !== id), source: null })
    tell(COPY.feedback.disconnected.title(WIRES[id].name), COPY.feedback.disconnected.detail)
  },
  power() {
    if (state.power !== 'off') { emit({ power: 'off', playing: false, experience: 'bench', deskView: 'screen' }); tell(COPY.feedback.poweredOff.title, COPY.feedback.poweredOff.detail); return }
    const missing = missingPower(state)
    if (missing.length) {
      const first = missing[0]
      emit({ hint: first.target, mode: first.target in PORTS ? 'wires' : 'parts' })
      return tell(COPY.feedback.powerMissing.title(missing.length), COPY.feedback.powerMissing.detail(first.label, missing.slice(1).map(x => x.label)), 'error')
    }
    emit({ power: 'booting', selected: null, source: null, hint: null, playing: true, heating: false })
    tell(COPY.feedback.booting.title, COPY.feedback.booting.detail)
  },
  booted(epoch: number) { if (state.epoch === epoch && state.power === 'booting') { emit({ power: 'on' }); tell(COPY.feedback.booted.title, COPY.feedback.booted.detail, 'success') } },
  brightness(value: number) { emit({ brightness: Math.max(15, Math.min(100, value)) }) },
  contrast(value: number) { emit({ contrast: Math.max(0, Math.min(100, value)) }) },
  sharpness(value: number) { emit({ sharpness: Math.max(0, Math.min(100, value)) }) },
  content(content: Content) { emit({ content, playing: state.power !== 'off' && content === 'film' }) },
  play() { if (state.power !== 'off' && state.content === 'film') emit({ playing: !state.playing }) },
  sound() { emit({ sound: !state.sound }) },
  enterDesk() {
    if (state.power !== 'on') return
    emit({ experience: 'desk', deskView: 'screen', playing: state.content === 'film', viewVersion: state.viewVersion + 1 })
  },
  leaveDesk() { if (state.experience !== 'bench') emit({ experience: 'bench', deskView: 'screen', viewVersion: state.viewVersion + 1 }) },
  deskMove(direction: -1 | 1) {
    if (state.experience !== 'desk') return
    const views: DeskView[] = ['desk', 'screen', 'window']
    emit({ deskView: views[(views.indexOf(state.deskView) + direction + views.length) % views.length], viewVersion: state.viewVersion + 1 })
  },
  lamp() { if (state.experience !== 'bench') emit({ lampOn: !state.lampOn }) },
  curtains() { if (state.experience !== 'bench') emit({ curtainsOpen: !state.curtainsOpen }) },
  cinema() {
    if (state.experience === 'desk') emit({ experience: 'cinema', deskView: 'screen', content: 'film', playing: true, lampOn: false, curtainsOpen: false, viewVersion: state.viewVersion + 1 })
  },
  leaveCinema() { if (state.experience === 'cinema') emit({ experience: 'desk', deskView: 'screen', viewVersion: state.viewVersion + 1 }) },
  hint() {
    if (state.source) return emit({ hint: WIRE_IDS.flatMap(w => WIRES[w].ends).find(p => p !== state.source && WIRE_IDS.some(w => WIRES[w].ends.includes(p) && WIRES[w].ends.includes(state.source!)))! })
    const id = state.selected || PART_IDS.find(p => !state.installed.includes(p) && !installationProblem(state, p))
    if (id && state.card === 'bench') { emit({ hint: id }); tell(COPY.feedback.hint.title, COPY.feedback.hint.detail(PARTS[id].name)) }
    else { const item = missingPower(state)[0]; if (item) emit({ hint: item.target, mode: item.target in PORTS ? 'wires' : 'parts' }) }
  },
  view() { emit({ viewVersion: state.viewVersion + 1 }) },
  cancel() { emit({ selected: null, source: null, hint: null, heating: false }) },
  reset() { const sound = state.sound; const epoch = state.epoch + 1; state = { ...initialState(epoch), phase: 'arranging', sound }; listeners.forEach(fn => fn()) },
  mediaError() { emit({ mediaError: true, playing: false }); tell(COPY.feedback.mediaError.title, COPY.feedback.mediaError.detail, 'error') },
  playbackBlocked() { emit({ playing: false }); tell(COPY.feedback.playbackBlocked.title, COPY.feedback.playbackBlocked.detail) }
}
