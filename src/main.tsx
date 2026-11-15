import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUpRight, ArrowRight, Power, Volume2, VolumeX, RotateCcw, RotateCw, Crosshair, HelpCircle, X, Check, Play, Pause, Sun, Contrast, Aperture, Flame, Cable, Layers3, ChevronLeft, ChevronRight, Home, Moon } from 'lucide-react'
import { BRAND, COPY, DISPLAY, GRAPHICS_IDS, MEDIA, MOUNT, PARTS, PART_IDS, PLATFORM_IDS, PORTS, PORT_IDS, SOLDER, WIRES, WIRE_IDS } from './config'
import { PROGRESS_TOTAL, lab, missingPower, progress, step } from './state'
import { LabScene } from './scene'
import './style.css'

function App() {
  const s = useSyncExternalStore(lab.subscribe, lab.get)
  const mount = useRef<HTMLDivElement>(null)
  const [fallback, setFallback] = useState(false)
  const [help, setHelp] = useState(false)
  const [reset, setReset] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const stage = step(s)
  const started = s.phase !== 'intro'
  const on = s.power !== 'off'
  const bench = s.experience === 'bench'
  const done = Math.round(progress(s))
  const reflow = Math.round(s.reflow)
  const hot = s.temp > SOLDER.ceiling
  const inWindow = s.temp >= SOLDER.target && s.temp <= SOLDER.ceiling
  const heatStatus = hot ? COPY.solder.overheat : s.soldered ? COPY.solder.done : inWindow ? COPY.solder.reflow : s.heating ? COPY.solder.heating : COPY.solder.soak
  const solderOpen = bench && !on && s.card === 'bench' && s.installed.includes('core') && !s.soldered
  const hold = (active: boolean) => lab.heat(active)
  const dock = useRef<HTMLElement>(null)
  const [dockPx, setDockPx] = useState<number | null>(null)
  const dockLimits = () => [168, Math.max(228, Math.min(560, Math.round(window.innerHeight - 300)))] as const
  const growDock = (px: number) => { const [min, max] = dockLimits(); setDockPx(Math.round(Math.min(max, Math.max(min, px)))) }
  const dragDock = (e: React.PointerEvent) => {
    const start = e.clientY, base = dock.current?.offsetHeight ?? 320
    growDock(base)
    const move = (ev: PointerEvent) => growDock(base + (start - ev.clientY))
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop)
    e.preventDefault(); e.stopPropagation()
  }
  useEffect(() => { if (dockPx === null && dock.current) setDockPx(dock.current.offsetHeight) }, [dockPx, started])
  useEffect(() => {
    let scene: LabScene | undefined
    try { scene = new LabScene(mount.current!); setSceneReady(true) } catch (error) { console.warn('3D unavailable', error); setFallback(true) }
    return () => scene?.dispose()
  }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setHelp(false); setReset(false) } }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [])
  return <main className={`lab ${started ? 'started' : 'intro'} ${on ? 'powered' : ''} experience-${s.experience}`} style={dockPx ? { '--dock-h': `${dockPx}px` } as React.CSSProperties : undefined}>
    <div className="stage" ref={mount}>
      <div className="scene-labels">
        {PART_IDS.map(id => <React.Fragment key={id}>
          <button className={`part-label ${s.selected === id ? 'selected' : ''}`} data-anchor={`part:${id}`} onClick={() => lab.select(id)} aria-label={`选择${PARTS[id].name}`}><span>{PARTS[id].number}</span>{PARTS[id].name}</button>
          <button className="slot-label" data-anchor={`slot:${id}`} data-slot={id} onClick={() => s.selected && lab.attempt(s.selected, PARTS[id].slot)} aria-label={`放入${PARTS[id].name}安装槽`}><Crosshair size={16}/><span>{COPY.scene.placeHere}</span></button>
        </React.Fragment>)}
        {PORT_IDS.map(id => <button key={id} data-anchor={`port:${id}`} data-port={id} className={`port-label ${PORTS[id].shape} ${s.source === id ? 'active' : ''} ${s.wires.some(w => WIRES[w].ends.includes(id)) ? 'connected' : ''} ${s.hint === id ? 'hinted' : ''}`} aria-label={`${id} ${PORTS[id].name}`} title={PORTS[id].name}><i/>{id}</button>)}
        <button className="hardware-label power-label" data-anchor="power" onClick={lab.power} aria-label="机箱实体电源开关" data-testid="bench-power"><Power size={13}/></button>
        <button className="hardware-label heat-label" data-anchor="heat" onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)} onContextMenu={e => e.preventDefault()} aria-label={COPY.solder.title} data-testid="scene-heat"><Flame size={13}/>{COPY.scene.holdHeat}</button>
        <button className="slot-label mount-label" data-anchor="mount" onClick={() => lab.attemptMount(MOUNT.position)} aria-label={COPY.mount.title} data-testid="scene-mount"><Crosshair size={16}/>{COPY.scene.mountHere}</button>
        <button className="hardware-label card-label" data-anchor="card" onClick={lab.unmount} aria-label={COPY.scene.backToBench} data-testid="scene-unmount"><ArrowUpRight size={13}/>{COPY.scene.backToBench}</button>
        <div className="hardware-label control-label" data-anchor="screen">{COPY.scene.firstLight}</div>
        <button className="desk-marker" data-anchor="desk:lamp" onClick={lab.lamp} data-testid="desk-lamp"><Sun size={14}/><span>{s.lampOn ? COPY.desk.lampOn : COPY.desk.lampOff}</span></button>
        <button className="desk-marker" data-anchor="desk:curtains" onClick={lab.curtains} data-testid="desk-curtains"><Layers3 size={14}/><span>{s.curtainsOpen ? COPY.desk.curtainsOpen : COPY.desk.curtainsClosed}</span></button>
        <button className="desk-marker primary" data-anchor="desk:screen" onClick={lab.cinema} data-testid="desk-watch"><Play size={14}/><span>{COPY.desk.watch}</span></button>
      </div>
    </div>
    <header className="header">
      <a className="brand" href="./" aria-label={`${COPY.header.title}首页`}><strong>{COPY.header.title}</strong></a>
      {started && bench && <nav className="steps" aria-label="装配阶段">{COPY.header.steps.map((name, i) => <span key={name} className={stage.index > i + 1 ? 'done' : stage.index === i + 1 ? 'current' : ''}><small>{stage.index > i + 1 ? <Check size={10}/> : `0${i + 1}`}</small>{name}{i < COPY.header.steps.length - 1 && <b/>}</span>)}</nav>}
      <div className="header-tools">{started && <span className="edition">{bench ? <>{BRAND.product} <b>/</b> {COPY.header.edition}</> : <>DESK <b>/</b> {COPY.desk.eyebrow.split(' / ')[1]}</>}</span>}<button className="icon-button" onClick={lab.sound} aria-label={s.sound ? '关闭声音' : '开启声音'} aria-pressed={s.sound} title={s.sound ? COPY.header.soundOff : COPY.header.soundDefaultOff}>{s.sound ? <Volume2/> : <VolumeX/>}</button><button className="icon-button" onClick={() => setHelp(true)} aria-label="操作指南"><HelpCircle/></button>{started && (bench ? <button className={`power-button ${on ? 'on' : ''}`} onClick={lab.power} data-testid="power"><Power size={16}/><span>{on ? COPY.header.powerOff : COPY.header.powerOn}</span></button> : <button className="power-button desk-return" onClick={lab.leaveDesk} data-testid="desk-return"><Home size={15}/><span>{COPY.desk.returnWorkshop}</span></button>)}</div>
    </header>
    {!started && !fallback && <section className="hero">
      <h1>{COPY.hero.title.firstLine}<br/>{COPY.hero.title.secondLine}</h1>
      <button className="start-button" onClick={lab.start} disabled={!sceneReady}>{COPY.hero.start} <ArrowUpRight size={22}/></button>
    </section>}
    {started && !fallback && <>
      {s.experience !== 'cinema' && <section className={`stage-heading ${bench ? '' : 'desk-heading'}`}><div className="eyebrow"><span/>{bench ? on ? COPY.scene.firstLight : COPY.scene.workshop(stage.index) : COPY.desk.eyebrow}</div><h1>{bench ? stage.title : COPY.desk.views[s.deskView].title}</h1><p>{bench ? s.phase === 'arranging' ? COPY.scene.arranging : stage.hint : COPY.desk.views[s.deskView].detail}</p></section>}
      {bench && <div className="scene-tools"><button onClick={lab.hint} disabled={on} aria-label="提示安装位置"><Crosshair/> <span>{COPY.scene.hint}</span></button><button onClick={lab.view} aria-label="复位视角"><RotateCcw/> <span>{COPY.scene.resetView}</span></button><button onClick={() => setReset(true)} disabled={on} aria-label="重新组装"><Layers3/><span>{COPY.scene.resetAssembly}</span></button></div>}
      {bench && !on && <div className="completion"><span>{String(done).padStart(2, '0')}<small> / {String(PROGRESS_TOTAL).padStart(2, '0')}</small></span><b>{COPY.scene.assembly}</b><div>{Array.from({ length: PROGRESS_TOTAL }, (_, i) => <i className={i < done ? 'filled' : ''} key={i}/>)}</div></div>}
      {bench && <aside className={`notice ${s.notice.kind}`} role="status" aria-live="polite"><span className="notice-dot"/><div><strong>{s.notice.title}</strong><p>{s.notice.detail}</p></div>{s.selected && !on && <div className="selection-actions">{s.installed.includes(s.selected) ? <button onClick={() => lab.remove(s.selected!)} data-testid="remove">{COPY.selection.retrieve} <ArrowUpRight size={13}/></button> : <button onClick={lab.rotate} data-testid="rotate"><RotateCw size={13}/>{COPY.selection.rotate} <kbd>R</kbd></button>}<button className="clear-selection" onClick={lab.cancel} aria-label="取消选择"><X size={15}/></button></div>}</aside>}
      {solderOpen && <section className="solder-station" data-testid="solder-station">
        <div className="eyebrow"><span/>{COPY.solder.eyebrow}</div>
        <h2>{COPY.solder.title}</h2>
        <div className="gauge"><div className="gauge-track"><i className="gauge-window" style={{ left: `${(SOLDER.target - SOLDER.ambient) / (SOLDER.max - SOLDER.ambient) * 100}%`, width: `${(SOLDER.ceiling - SOLDER.target) / (SOLDER.max - SOLDER.ambient) * 100}%` }}/><b className={hot ? 'hot' : ''} style={{ width: `${Math.min(100, s.temp / SOLDER.max * 100)}%` }}/></div><output>{Math.round(s.temp)}°C</output></div>
        <div className="gauge-scale"><span>{COPY.solder.temperature} {SOLDER.ambient}°</span><span>{COPY.solder.window} {SOLDER.target}–{SOLDER.ceiling}°</span><span>{SOLDER.max}°</span></div>
        <div className="reflow"><span>{COPY.solder.progress}</span><div className="reflow-track"><i style={{ width: `${reflow}%` }}/></div><output>{reflow}%</output></div>
        <button className={`heat-button ${s.heating ? 'heating' : ''}`} onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)} onContextMenu={e => e.preventDefault()} data-testid="heat"><Flame size={15}/><span>{COPY.scene.holdHeat}</span><small>{COPY.scene.heatRelease}</small></button>
        <p className={`solder-status ${hot ? 'error' : ''}`}>{heatStatus}</p>
        {s.scorches > 0 && <div className="damage">{COPY.solder.damage} <b>{s.scorches}</b></div>}
      </section>}
      {!on ? <section className="assembly-dock" ref={dock}>
        <div className="dock-resizer" role="slider" tabIndex={0} data-testid="dock-resizer" aria-label={COPY.dock.resize} aria-orientation="vertical" aria-valuemin={dockLimits()[0]} aria-valuemax={dockLimits()[1]} aria-valuenow={dockPx ?? undefined} onPointerDown={dragDock} onKeyDown={e => {
          const height = dock.current?.offsetHeight ?? 320
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); growDock(height + (e.key === 'ArrowUp' ? 24 : -24)) }
          else if (e.key === 'Home') { e.preventDefault(); growDock(dockLimits()[0]) }
          else if (e.key === 'End') { e.preventDefault(); growDock(dockLimits()[1]) }
        }}><span/></div>
        <div className="dock-top"><div className="mode-switch"><button className={s.mode === 'parts' ? 'active' : ''} onClick={() => lab.mode('parts')} data-testid="parts-mode"><Layers3 size={13}/>{COPY.dock.parts} <small>{String(PART_IDS.length).padStart(2, '0')}</small></button><button className={s.mode === 'wires' ? 'active' : ''} onClick={() => lab.mode('wires')} data-testid="wires-mode"><Cable size={13}/>{COPY.dock.wires} <small>{String(WIRE_IDS.length).padStart(2, '0')}</small></button></div><span className="dock-tip">{s.mode === 'parts' ? COPY.dock.desktop.parts : COPY.dock.desktop.wires}</span><span className="touch-tip">{s.mode === 'parts' ? COPY.dock.touch.parts : COPY.dock.touch.wires}</span></div>
        {s.mode === 'parts' ? <div className="parts-rail">{([['platform', COPY.dock.platform, PLATFORM_IDS], ['graphics', COPY.dock.graphics, GRAPHICS_IDS]] as const).map(([group, name, ids]) => <section className="part-group" key={group}><h3>{name}<small>{String(ids.length).padStart(2, '0')}</small></h3><div className="part-grid">{ids.map(id => <button key={id} className={`part-card ${s.selected === id ? 'active' : ''} ${s.installed.includes(id) ? 'installed' : ''}`} data-testid={`part-${id}`} onClick={() => lab.select(id)}><span className={`mini-part mini-${id}`}><i/><i/><i/></span><span className="part-copy"><small>{PARTS[id].number} / {s.installed.includes(id) ? COPY.dock.installed : COPY.dock.pending}</small><strong>{PARTS[id].name}</strong></span>{s.installed.includes(id) ? <Check size={13}/> : <span className="part-dot"/>}</button>)}</div></section>)}</div> : <div className="wires-rail">{WIRE_IDS.map(id => <div className={`wire-card ${s.wires.includes(id) ? 'connected' : ''}`} key={id}><div><span>{WIRES[id].ends[0]} <b>↔</b> {WIRES[id].ends[1]}</span><small>{WIRES[id].name}</small></div>{s.wires.includes(id) ? <button onClick={() => lab.disconnect(id)} data-testid={`disconnect-${id}`}>{COPY.dock.disconnect} <X size={12}/></button> : <span className="wire-pending">{COPY.dock.pendingConnection}</span>}</div>)}</div>}
      </section> : <>
        {on && bench && <section className="desk-entry"><div><span>{COPY.desk.entry.eyebrow}</span><strong>{COPY.desk.entry.title}</strong><p>{COPY.desk.entry.detail}</p></div><button onClick={lab.enterDesk} data-testid="enter-desk">{COPY.desk.entry.action}<ArrowUpRight size={17}/></button></section>}
        {s.experience === 'desk' && <nav className="desk-navigation" aria-label="桌面视角"><button onClick={() => lab.deskMove(-1)} aria-label="上一个桌面视角" data-testid="desk-prev"><ChevronLeft/></button><div><span>{COPY.desk.hint}</span><b>{(['desk', 'screen', 'window'] as const).map(view => <i key={view} className={s.deskView === view ? 'active' : ''}/>)}</b></div><button onClick={() => lab.deskMove(1)} aria-label="下一个桌面视角" data-testid="desk-next"><ChevronRight/></button></nav>}
        {s.experience === 'cinema' && <button className="leave-cinema" onClick={lab.leaveCinema} data-testid="leave-cinema"><Moon size={14}/>{COPY.desk.leaveCinema}<span>ESC</span></button>}
        <section className={`display-dock ${s.experience}`}>
          <div className="film-bar"><div className="film-name"><span className="live-dot"/><div><strong>{s.content === 'film' ? MEDIA.filmTitle : s.content === 'bench' ? MEDIA.gridTitle : MEDIA.colorTitle}</strong><small>{s.content === 'film' ? MEDIA.filmSubtitle : COPY.display.generated}</small></div></div><div className="content-switch" aria-label="屏幕内容"><button className={s.content === 'film' ? 'active' : ''} onClick={() => lab.content('film')} data-testid="content-film">{COPY.display.film}</button><button className={s.content === 'bench' ? 'active' : ''} onClick={() => lab.content('bench')} data-testid="content-bench">{COPY.display.grid}</button><button className={s.content === 'color' ? 'active' : ''} onClick={() => lab.content('color')} data-testid="content-color">{COPY.display.color}</button></div><button className="play-button" onClick={lab.play} disabled={s.content !== 'film' || s.mediaError} aria-label={s.playing ? '暂停影片' : '播放影片'} data-testid="play">{s.playing ? <Pause size={17}/> : <Play size={17}/>}</button></div>
          <div className="adjustments">
            <label><Sun size={16}/><span>{COPY.display.brightness}</span><input aria-label={COPY.display.brightness} type="range" min="15" max="100" value={s.brightness} onChange={e => lab.brightness(+e.target.value)}/><output>{Math.round(s.brightness)}%</output></label><i/>
            <label><Contrast size={16}/><span>{COPY.display.contrast}</span><input aria-label={COPY.display.contrast} type="range" min="0" max="100" value={s.contrast} onChange={e => lab.contrast(+e.target.value)}/><output>{Math.round(s.contrast)}%</output></label><i/>
            <label><Aperture size={16}/><span>{COPY.display.sharpness}</span><input aria-label={COPY.display.sharpness} type="range" min="0" max="100" value={s.sharpness} onChange={e => lab.sharpness(+e.target.value)}/><output>{Math.round(s.sharpness)}%</output></label>
            <span className="sweet-spot" style={{ left: `${DISPLAY.imageSweetSpot}%` }}/>
          </div>
        </section></>}
      {s.experience !== 'cinema' && <footer className="workshop-footer"><span>{BRAND.name} {BRAND.product} <i>·</i> {COPY.footer.safety}</span><span>{bench ? on ? COPY.footer.completed : COPY.footer.navigation : COPY.desk.hint}</span></footer>}
    </>}
    {fallback && <section className="fallback"><span className="eyebrow">{COPY.fallback.eyebrow}</span><h1>{COPY.fallback.title}</h1><p>{COPY.fallback.browser}</p><p>{COPY.fallback.experience}</p><button onClick={() => location.reload()}>{COPY.fallback.retry} <RotateCcw size={15}/></button></section>}
    {(help || reset) && <div className="modal-backdrop" onClick={() => { setHelp(false); setReset(false) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}><button className="modal-close icon-button" onClick={() => { setHelp(false); setReset(false) }} aria-label="关闭对话框"><X/></button>{reset ? <><div className="eyebrow">{COPY.reset.eyebrow}</div><h2 id="dialog-title">{COPY.reset.title}</h2><p>{COPY.reset.detail}</p><button className="start-button" onClick={() => { lab.reset(); setReset(false) }} data-testid="confirm-reset">{COPY.reset.confirm} <ArrowRight size={18}/></button></> : <><div className="eyebrow">{COPY.help.eyebrow}</div><h2 id="dialog-title">{COPY.help.title}</h2>{COPY.help.steps.map(row => <div className="help-row" key={row.number}><b>{row.number}</b><div><strong>{row.title}</strong><p>{row.detail}</p></div></div>)}<div className="help-foot">{COPY.help.brandCredit}<br/>{COPY.help.safety}<br/><br/>{COPY.help.filmCredit}<br/>{COPY.help.filmLicense}<br/><a href="./media/LICENSE.txt" target="_blank" rel="noreferrer">{COPY.help.licenseLink}</a></div></>}</section></div>}
    <div className="sr-only" aria-live="polite">{missingPower(s).map(x => x.label).join('；')}</div>
  </main>
}
const root = createRoot(document.getElementById('root')!)
root.render(<App/>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
