import * as THREE from 'three'
import { DISPLAY, MEDIA } from './config'
import { lab } from './state'
import type { LabState } from './state'
import type { LabScene } from './scene'

const clamp = THREE.MathUtils.clamp
const ramp = (time: number, start: number, end: number) => THREE.MathUtils.smoothstep(time, start, end)
const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    // The panel is turned to face the bench, so flip u to keep the image unmirrored.
    vUv = vec2(1.0 - uv.x, uv.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const screenFragment = /* glsl */`
  uniform sampler2D uMap;
  uniform vec2 uTexel;
  uniform float uVideo;
  uniform float uReady;
  uniform float uBlur;
  uniform float uSharpen;
  uniform float uBright;
  uniform float uContrast;
  uniform float uReveal;
  varying vec2 vUv;

  vec3 sampleLinear(vec2 offset) {
    vec2 coordinate = clamp(vUv + offset, uTexel * 0.5, vec2(1.0) - uTexel * 0.5);
    vec4 pixel = texture2D(uMap, coordinate);
    // Video arrives as RGBA8, unlike sRGB CanvasTextures, so decode before filtering.
    if (uVideo > 0.5) pixel = sRGBTransferEOTF(pixel);
    return pixel.rgb;
  }

  void main() {
    vec3 image = vec3(0.0);
    if (uReady > 0.5) {
      vec2 d = uTexel * uBlur;
      // Normalised 13-tap Gaussian approximation; at the sweet spot every tap coincides.
      vec3 centre = sampleLinear(vec2(0.0));
      vec3 soft = centre * 0.20;
      soft += sampleLinear(vec2( d.x, 0.0)) * 0.12;
      soft += sampleLinear(vec2(-d.x, 0.0)) * 0.12;
      soft += sampleLinear(vec2(0.0,  d.y)) * 0.12;
      soft += sampleLinear(vec2(0.0, -d.y)) * 0.12;
      soft += sampleLinear(vec2( d.x,  d.y)) * 0.06;
      soft += sampleLinear(vec2(-d.x,  d.y)) * 0.06;
      soft += sampleLinear(vec2( d.x, -d.y)) * 0.06;
      soft += sampleLinear(vec2(-d.x, -d.y)) * 0.06;
      soft += sampleLinear(vec2(2.0 * d.x, 0.0)) * 0.02;
      soft += sampleLinear(vec2(-2.0 * d.x, 0.0)) * 0.02;
      soft += sampleLinear(vec2(0.0, 2.0 * d.y)) * 0.02;
      soft += sampleLinear(vec2(0.0, -2.0 * d.y)) * 0.02;
      vec3 lap = centre * 4.0
        - sampleLinear(vec2( uTexel.x, 0.0)) - sampleLinear(vec2(-uTexel.x, 0.0))
        - sampleLinear(vec2(0.0,  uTexel.y)) - sampleLinear(vec2(0.0, -uTexel.y));
      image = soft + uSharpen * lap * 0.26;
      image = (image - 0.5) * uContrast + 0.5;
    }
    float edge = smoothstep(0.0, 0.006, vUv.x) * smoothstep(0.0, 0.006, 1.0 - vUv.x)
               * smoothstep(0.0, 0.006, vUv.y) * smoothstep(0.0, 0.006, 1.0 - vUv.y);
    float falloff = 1.0 - 0.16 * dot(vUv - 0.5, vUv - 0.5);
    float pixels = 1.0 - 0.03 * step(0.5, fract(vUv.y * 360.0));
    vec3 panel = vec3(0.011, 0.012, 0.013);
    gl_FragColor = vec4(panel + image * uBright * uReveal * edge * falloff * pixels, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function pattern(kind: 'bench' | 'color') {
  const canvas = document.createElement('canvas')
  canvas.width = 1280; canvas.height = 720
  const ctx = canvas.getContext('2d')!
  const w = canvas.width, h = canvas.height
  if (kind === 'bench') {
    ctx.fillStyle = '#192323'; ctx.fillRect(0, 0, w, h)
    for (let x = 0; x <= w; x += 40) {
      ctx.strokeStyle = x % 160 === 0 ? '#a5b5ae' : '#516662'
      ctx.lineWidth = x % 160 === 0 ? 2 : 1
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y <= h; y += 40) {
      ctx.strokeStyle = y % 160 === 0 ? '#a5b5ae' : '#516662'
      ctx.lineWidth = y % 160 === 0 ? 2 : 1
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    ctx.strokeStyle = '#faf6e8'; ctx.lineWidth = 3
    for (const radius of [70, 140, 245]) {
      ctx.beginPath(); ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.strokeStyle = '#ed9b62'
    ctx.beginPath(); ctx.moveTo(w / 2 - 35, h / 2); ctx.lineTo(w / 2 + 35, h / 2)
    ctx.moveTo(w / 2, h / 2 - 35); ctx.lineTo(w / 2, h / 2 + 35); ctx.stroke()
    for (const x of [85, w - 245]) {
      ctx.fillStyle = '#f4f0df'; ctx.fillRect(x, h / 2 - 64, 160, 128)
      ctx.fillStyle = '#1a2323'
      for (let i = 0; i < 32; i++) ctx.fillRect(x + i * 5, h / 2 - 64, 2, 128)
    }
    ctx.fillStyle = '#192323'; ctx.fillRect(330, 48, 620, 62)
    ctx.fillStyle = '#f4f0df'; ctx.font = '24px monospace'; ctx.textAlign = 'center'
    ctx.fillText(`VOLTA G01 / ${MEDIA.gridTitle} / 16:9`, w / 2, 88)
    ctx.textAlign = 'left'; ctx.fillText('F1 / F2 LINK OK', 34, h - 30)
    ctx.textAlign = 'right'; ctx.fillText('REFLOW VERIFIED', w - 34, h - 30)
  } else {
    const colors = ['#ece9d6', '#efd361', '#6ac6c4', '#82ab76', '#cd7b9c', '#d8724d', '#527dab']
    colors.forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(i * w / 7, 0, w / 7 + 1, h * .69) })
    const gradient = ctx.createLinearGradient(0, 0, w, 0)
    gradient.addColorStop(0, '#102633'); gradient.addColorStop(.45, '#af6f65'); gradient.addColorStop(1, '#f4daac')
    ctx.fillStyle = gradient; ctx.fillRect(0, h * .69, w, h * .18)
    for (let i = 0; i < 16; i++) {
      const level = Math.round(i / 15 * 255)
      ctx.fillStyle = `rgb(${level},${level},${level})`; ctx.fillRect(i * w / 16, h * .87, w / 16 + 1, h * .13)
    }
    ctx.fillStyle = '#263635'; ctx.font = '24px monospace'; ctx.textAlign = 'left'
    ctx.fillText(`VOLTA / ${MEDIA.colorTitle}`, 36, 54)
    ctx.font = '16px monospace'
    colors.forEach((_, i) => ctx.fillText(String(i + 1).padStart(2, '0'), i * w / 7 + 22, h * .64))
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

export function createProjection(scene: LabScene): { update(delta: number, time: number): void; dispose(): void; read(): unknown } {
  let disposed = false
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motion.matches
  const video = document.createElement('video')
  video.muted = true; video.defaultMuted = true; video.loop = true
  video.playsInline = true; video.preload = 'metadata'
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '')
  const makeVideoTexture = () => {
    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    return texture
  }
  let videoTexture = makeVideoTexture()
  const benchTexture = pattern('bench'), colorTexture = pattern('color')
  const uniforms = {
    uMap: { value: videoTexture as THREE.Texture }, uTexel: { value: new THREE.Vector2(1 / 640, 1 / 360) },
    uVideo: { value: 1 }, uReady: { value: 0 }, uBlur: { value: 0 }, uSharpen: { value: 0 },
    uBright: { value: 1 }, uContrast: { value: 1 }, uReveal: { value: 0 }
  }
  const surfaceMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader: screenFragment, toneMapped: false })
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(DISPLAY.width, DISPLAY.height), surfaceMaterial)
  surface.name = 'monitorSurface'
  const screen = new THREE.Group()
  screen.name = 'monitorScreen'; screen.position.set(...DISPLAY.panel); screen.rotation.y = Math.PI
  screen.add(surface)
  // Visual-only objects must not intercept assembly or control picking.
  screen.traverse(object => { object.raycast = () => {} })
  const glow = new THREE.PointLight('#cfe1ff', 0, 8, 2)
  glow.position.set(...DISPLAY.glow)
  scene.scene.add(screen, glow)

  const originalAmbient = scene.ambient.intensity, originalSun = scene.sun.intensity
  const background = scene.scene.background instanceof THREE.Color ? scene.scene.background : null
  const originalBackground = background?.clone()
  const fog = scene.scene.fog, originalFog = fog?.color.clone()
  const benchTone = new THREE.Color('#a8a49b')
  const nightTone = new THREE.Color('#2a2725')

  let epoch = lab.get().epoch, bootEpoch = epoch
  let previousPower: LabState['power'] = 'off'
  let elapsed = 0, bootNotified = false, lastTime = 0
  let requestedPlay = false, playVersion = 0, mediaReported = false, rewindPending = false
  let audio: AudioContext | null = null, master: GainNode | null = null
  let hum: OscillatorNode | null = null, humGain: GainNode | null = null
  let audioGate = false, humGate = false, audioBlocked = false
  const chimes = new Map<OscillatorNode, GainNode>()

  const audioAllowed = () => !disposed && !document.hidden && lab.get().sound && lab.get().power !== 'off'
  const wantsPlayback = () => {
    const s = lab.get()
    return !disposed && !document.hidden && s.power !== 'off' && elapsed >= 2 && s.playing && s.content === 'film' && !s.mediaError
  }
  function stopChimes() {
    chimes.forEach((gain, oscillator) => {
      oscillator.onended = null
      try { oscillator.stop() } catch { /* Already ended. */ }
      oscillator.disconnect(); gain.disconnect()
    })
    chimes.clear()
  }
  function syncAudio(startup = false, retry = false) {
    const allowed = audioAllowed()
    if (!allowed) {
      if (audio && master) {
        master.gain.cancelScheduledValues(audio.currentTime); master.gain.setValueAtTime(0, audio.currentTime)
        humGain?.gain.cancelScheduledValues(audio.currentTime); humGain?.gain.setValueAtTime(0, audio.currentTime)
        stopChimes()
        if (audioGate) void audio.suspend().catch(() => {})
      }
      audioGate = false; humGate = false
      return
    }
    if (!audio && (!audioBlocked || retry)) {
      try {
        // No AudioContext, oscillators or permission prompts until sound is opted in.
        audio = new AudioContext()
        master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination)
        humGain = audio.createGain(); humGain.gain.value = 0; humGain.connect(master)
        hum = audio.createOscillator(); hum.type = 'sine'; hum.frequency.value = 78
        hum.connect(humGain); hum.start()
      } catch { audioBlocked = true; return }
    }
    if (!audio || !master || !humGain) return
    const context = audio
    if (!audioGate || retry) {
      audioGate = true
      master.gain.cancelScheduledValues(context.currentTime)
      master.gain.setTargetAtTime(1, context.currentTime, .025)
      void context.resume().then(() => {
        if (disposed) return
        audioBlocked = context.state !== 'running'
        if (!audioAllowed()) {
          master?.gain.cancelScheduledValues(context.currentTime)
          master?.gain.setValueAtTime(0, context.currentTime)
          void context.suspend().catch(() => {})
        }
      }).catch(() => { audioBlocked = true })
    }
    const fanRunning = elapsed >= .4
    if (fanRunning !== humGate) {
      humGate = fanRunning
      humGain.gain.cancelScheduledValues(context.currentTime)
      humGain.gain.setTargetAtTime(fanRunning ? .009 : 0, context.currentTime, .08)
    }
    if (startup) {
      const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(329.63, now)
      oscillator.frequency.exponentialRampToValueAtTime(493.88, now + .24)
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.026, now + .035)
      gain.gain.exponentialRampToValueAtTime(.0001, now + .42)
      oscillator.connect(gain); gain.connect(master); chimes.set(oscillator, gain)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); chimes.delete(oscillator) }
      oscillator.start(now); oscillator.stop(now + .44)
    }
  }

  function reportMediaError() {
    if (disposed || mediaReported) return
    mediaReported = true; lab.mediaError()
  }
  function syncPlayback() {
    const wanted = wantsPlayback()
    if (wanted === requestedPlay) return
    requestedPlay = wanted
    const version = ++playVersion
    if (!wanted) { video.pause(); return }
    const failed = (error: unknown) => {
      if (disposed || version !== playVersion || !wantsPlayback()) return
      requestedPlay = false
      if (error instanceof DOMException && (error.name === 'NotSupportedError' || video.error)) reportMediaError()
      else lab.playbackBlocked()
    }
    try {
      void video.play().then(() => {
        // A late play promise must not resurrect playback after reset/off/visibility changes.
        if (disposed || !wantsPlayback()) video.pause()
      }).catch(failed)
    } catch (error) { failed(error) }
  }
  function finishRewind() {
    if (!rewindPending || video.readyState < 1) return
    try {
      if (Math.abs(video.currentTime) > .001) video.currentTime = 0
      if (!video.seeking && video.readyState >= 2 && Math.abs(video.currentTime) <= .001) {
        rewindPending = false; videoTexture.needsUpdate = true
      }
    } catch { /* Metadata/seekability may arrive after a reset. Keep the old frame hidden. */ }
  }
  function resetMedia() {
    ++playVersion; requestedPlay = false; video.pause()
    mediaReported = false; rewindPending = true
    try { video.currentTime = 0 } catch { /* loadedmetadata will retry. */ }
    const old = videoTexture
    videoTexture = makeVideoTexture()
    if (uniforms.uMap.value === old) uniforms.uMap.value = videoTexture
    old.dispose()
    benchTexture.needsUpdate = true; colorTexture.needsUpdate = true
    uniforms.uReady.value = 0
    if (video.error) video.load()
    finishRewind()
  }
  function updateSurface(s: LabState) {
    const film = s.content === 'film'
    const width = film ? video.videoWidth || 640 : 1280
    const height = film ? video.videoHeight || 720 : 720
    uniforms.uMap.value = film ? videoTexture : s.content === 'bench' ? benchTexture : colorTexture
    uniforms.uVideo.value = film ? 1 : 0
    uniforms.uReady.value = film ? Number(video.readyState >= 2 && !rewindPending && !s.mediaError) : 1
    uniforms.uTexel.value.set(1 / width, 1 / height)
    // Radius is measured in source pixels so the same slider travel means the same softness on any source.
    const sweet = DISPLAY.imageSweetSpot
    const softness = clamp((sweet - s.sharpness) / sweet, 0, 1)
    uniforms.uBlur.value = Math.pow(softness, 1.15) * 14 * height / 360
    uniforms.uSharpen.value = clamp((s.sharpness - sweet) / (100 - sweet), 0, 1)
    uniforms.uBright.value = .34 + clamp(s.brightness, 0, 100) / 100 * 1.02
    uniforms.uContrast.value = .62 + clamp(s.contrast, 0, 100) / 100 * .88
  }
  function applyVisuals(s: LabState) {
    const powered = s.power !== 'off'
    const stage = (start: number, end: number) => powered ? reduced ? Number(elapsed >= start) : ramp(elapsed, start, end) : 0
    const backlight = stage(1.3, 2), reveal = stage(2, 2.65)
    screen.visible = powered
    surface.visible = powered && elapsed >= 2
    uniforms.uReveal.value = reveal
    const inDesk = s.experience !== 'bench'
    glow.intensity = backlight * uniforms.uBright.value * (inDesk ? 2.6 : 1.1)
    const dim = stage(.9, 2.2)
    const ambientTarget = inDesk ? s.experience === 'cinema' ? .16 : .34 : .55
    const sunTarget = inDesk ? .12 : .72
    const tone = inDesk ? nightTone : benchTone
    scene.ambient.intensity = THREE.MathUtils.lerp(originalAmbient, ambientTarget, dim)
    scene.sun.intensity = THREE.MathUtils.lerp(originalSun, sunTarget, dim)
    if (background && originalBackground) background.copy(originalBackground).lerp(tone, dim)
    if (fog && originalFog) fog.color.copy(originalFog).lerp(tone, dim)
  }
  function syncState() {
    if (disposed) return
    const s = lab.get()
    if (s.epoch !== epoch) {
      epoch = s.epoch; bootEpoch = epoch; elapsed = 0; bootNotified = false
      previousPower = 'off'; resetMedia(); stopChimes()
    }
    const startup = s.power === 'booting' && previousPower !== 'booting' && previousPower !== 'on'
    if (s.power !== previousPower) {
      if (s.power === 'off') { elapsed = 0; bootNotified = false }
      else if (s.power === 'booting') { elapsed = 0; bootEpoch = s.epoch; bootNotified = false }
      else elapsed = Math.max(elapsed, 2.8)
      previousPower = s.power
    }
    updateSurface(s); applyVisuals(s); syncPlayback(); syncAudio(startup)
  }
  const mediaReady = () => {
    if (disposed) return
    finishRewind()
    if (video.readyState >= 2 && !rewindPending) videoTexture.needsUpdate = true
    updateSurface(lab.get())
  }
  const mediaFailure = () => { if (video.error) reportMediaError() }
  const visibilityChanged = () => { if (disposed) return; syncPlayback(); syncAudio() }
  const motionChanged = () => { reduced = motion.matches; if (!disposed) applyVisuals(lab.get()) }
  const audioGesture = () => {
    if (audioAllowed() && (audioBlocked || audio?.state === 'suspended')) syncAudio(false, true)
  }
  for (const event of ['loadedmetadata', 'loadeddata', 'seeked', 'canplay']) video.addEventListener(event, mediaReady)
  video.addEventListener('error', mediaFailure)
  document.addEventListener('visibilitychange', visibilityChanged)
  motion.addEventListener('change', motionChanged)
  window.addEventListener('pointerdown', audioGesture)
  window.addEventListener('keydown', audioGesture)
  video.src = MEDIA.film
  const unsubscribe = lab.subscribe(syncState)
  syncState()

  return {
    update(delta, time) {
      if (disposed) return
      lastTime = time
      syncState()
      if (document.hidden) return
      const dt = Number.isFinite(delta) ? Math.max(0, delta) : 0
      let s = lab.get()
      if (s.power === 'booting') elapsed = Math.min(2.8, elapsed + dt)
      finishRewind()
      updateSurface(s); applyVisuals(s); syncPlayback(); syncAudio()
      if (s.power === 'booting' && elapsed >= 2.8 && !bootNotified && s.epoch === bootEpoch) {
        bootNotified = true; lab.booted(bootEpoch)
        s = lab.get(); updateSurface(s); applyVisuals(s)
      }
    },
    read() {
      // Detached scalar/array snapshots only: no DOM, textures, uniforms or mutation hooks escape.
      const s = lab.get()
      const phase = s.power === 'off' ? 'off' : elapsed < .4 ? 'indicator' : elapsed < .9 ? 'fan'
        : elapsed < 1.3 ? 'brand' : elapsed < 2 ? 'backlight' : elapsed < 2.8 ? 'image' : 'ready'
      return {
        disposed, epoch, time: lastTime, reducedMotion: reduced,
        video: { readyState: video.readyState, currentTime: video.currentTime, paused: video.paused,
          width: video.videoWidth, height: video.videoHeight, seeking: video.seeking, rewindPending },
        content: s.content, playing: s.playing,
        adjust: { brightness: uniforms.uBright.value, contrast: uniforms.uContrast.value, sharpness: s.sharpness,
          blur: uniforms.uBlur.value, sharpen: uniforms.uSharpen.value, sweetSpot: DISPLAY.imageSweetSpot },
        texture: { kind: uniforms.uVideo.value ? 'video' : 'canvas', ready: uniforms.uReady.value === 1, version: uniforms.uMap.value.version },
        screen: { visible: screen.visible, imageVisible: surface.visible && screen.visible, reveal: uniforms.uReveal.value,
          position: screen.position.toArray(), rotation: [0, Math.PI, 0], width: DISPLAY.width, height: DISPLAY.height,
          normal: [0, 0, -1], horizontal: [-1, 0, 0] },
        glow: { intensity: glow.intensity, position: glow.position.toArray() },
        boot: { phase, elapsed, epoch: bootEpoch, notified: bootNotified },
        lighting: { ambient: scene.ambient.intensity, sun: scene.sun.intensity, background: background?.getHexString() ?? null, fog: fog?.color.getHexString() ?? null },
        audio: { created: audio !== null, state: audio?.state ?? 'uncreated', muted: !audioAllowed() || audio?.state !== 'running',
          blocked: audioBlocked, gain: master?.gain.value ?? 0, humGain: humGain?.gain.value ?? 0 }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true; unsubscribe(); ++playVersion
      video.pause()
      for (const event of ['loadedmetadata', 'loadeddata', 'seeked', 'canplay']) video.removeEventListener(event, mediaReady)
      video.removeEventListener('error', mediaFailure)
      document.removeEventListener('visibilitychange', visibilityChanged)
      motion.removeEventListener('change', motionChanged)
      window.removeEventListener('pointerdown', audioGesture); window.removeEventListener('keydown', audioGesture)
      videoTexture.dispose(); benchTexture.dispose(); colorTexture.dispose()
      video.removeAttribute('src'); video.load(); video.remove()
      stopChimes()
      if (hum) { hum.stop(); hum.disconnect() }
      humGain?.disconnect(); master?.disconnect()
      if (audio) void audio.close().catch(() => {})
      scene.scene.remove(screen, glow)
      surface.geometry.dispose(); surfaceMaterial.dispose()
      scene.ambient.intensity = originalAmbient; scene.sun.intensity = originalSun
      if (background && originalBackground) background.copy(originalBackground)
      if (fog && originalFog) fog.color.copy(originalFog)
    }
  }
}
