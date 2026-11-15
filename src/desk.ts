import * as THREE from 'three'
import { box, cylinder, label } from './models'
import type { LabState } from './state'

const mat = (color: string, roughness = .78, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

function nightTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024; canvas.height = 640
  const ctx = canvas.getContext('2d')!
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height)
  sky.addColorStop(0, '#0d1522'); sky.addColorStop(.55, '#1f2b3c'); sky.addColorStop(1, '#5b5f52')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#e3e6d5'
  for (let i = 0; i < 90; i++) {
    const x = (i * 149) % canvas.width, y = (i * 71) % 340
    ctx.globalAlpha = .2 + (i % 5) * .12; ctx.fillRect(x, y, i % 4 === 0 ? 3 : 2, 2)
  }
  ctx.globalAlpha = 1
  const moon = ctx.createRadialGradient(760, 140, 10, 760, 140, 90)
  moon.addColorStop(0, '#f4f1e2'); moon.addColorStop(1, '#f4f1e200')
  ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(760, 140, 90, 0, Math.PI * 2); ctx.fill()
  const trees = ['#101612', '#161d18', '#1d251f']
  for (let i = 0; i < 26; i++) {
    const width = 26 + (i * 37) % 60, height = 120 + (i * 53) % 210, x = i * 40 - 18
    ctx.fillStyle = trees[i % trees.length]
    ctx.beginPath(); ctx.moveTo(x, canvas.height); ctx.lineTo(x + width / 2, canvas.height - height); ctx.lineTo(x + width, canvas.height); ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = '#d9a55f'
  for (let i = 0; i < 14; i++) ctx.fillRect(60 + i * 70, canvas.height - 60 - (i % 3) * 24, 6, 9)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createDesk(scene: THREE.Scene, reduced: boolean) {
  const group = new THREE.Group(); group.name = 'desk'; group.visible = false
  const plaster = mat('#b9ac97', .97)
  const walnut = mat('#6b5140', .84)
  const darkWood = mat('#463830', .8)
  const fabric = mat('#7c5347', .99)
  const steel = mat('#8b938c', .42, .62)
  const linen = mat('#d7c6ab', .98)

  box(group, [26, 9, .3], [1.2, 4.2, 7.34], plaster, .04)
  box(group, [.3, 9, 15], [-10.2, 4.2, 0], mat('#a89b87', .97), .04)
  box(group, [26, .2, .5], [1.2, .6, 7.24], darkWood, .02)
  box(group, [5.1, .16, .18], [4.4, 6.62, 7.06], walnut, .02)
  const view = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2), new THREE.MeshBasicMaterial({ map: nightTexture() }))
  view.position.set(4.4, 4.9, 7.15); group.add(view)
  for (const x of [3.2, 4.4, 5.6]) box(group, [.08, 3.2, .1], [x, 4.9, 7.06], walnut, .01)
  for (const y of [3.7, 4.9, 6.1]) box(group, [4.6, .08, .1], [4.4, y, 7.06], walnut, .01)
  const leftCurtain = box(group, [2.5, 3.9, .2], [1.4, 4.7, 6.9], fabric, .1)
  const rightCurtain = box(group, [2.5, 3.9, .2], [7.4, 4.7, 6.9], fabric, .1)
  for (const curtain of [leftCurtain, rightCurtain]) for (let y = -1.5; y <= 1.5; y += .32) box(curtain, [2.3, .03, .02], [0, y, .11], mat('#93655a', 1), .005)
  cylinder(group, .05, 6.6, [4.4, 6.78, 6.86], steel, 'x')

  const lamp = new THREE.Group(); lamp.name = 'deskLamp'; lamp.position.set(-4.5, 0, 2.6); group.add(lamp)
  cylinder(lamp, .34, .07, [0, .04, 0], darkWood)
  cylinder(lamp, .05, 1.5, [.16, .79, -.1], steel)
  const arm = cylinder(lamp, .045, 1.2, [.52, 1.6, -.26], steel); arm.rotation.z = -.9
  const shadeMaterial = new THREE.MeshStandardMaterial({ color: '#e6c08a', roughness: .82, emissive: '#ffc77c', emissiveIntensity: .5 })
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.26, .5, .6, 30, 1, true), shadeMaterial)
  shade.position.set(.95, 1.42, -.34); shade.rotation.z = .38; shade.castShadow = true; lamp.add(shade)
  const lampLight = new THREE.PointLight('#ffb86d', 2.1, 13, 1.7)
  lampLight.position.set(-3.5, 1.4, 2.26); lampLight.castShadow = true; lampLight.shadow.mapSize.set(512, 512); group.add(lampLight)

  box(group, [1.6, .06, .56], [-1.6, .04, -3.6], mat('#2f3531', .82), .02)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 13; j++) box(group, [.09, .014, .035], [-2.28 + j * .113, .075, -3.78 + i * .1], mat(i === 1 ? '#3d4a41' : '#4b5450', .7), .003)
  const mouse = box(group, [.11, .05, .18], [.35, .06, -3.6], mat('#333936', .6), .04)
  mouse.rotation.y = .22
  box(group, [.5, .16, .5], [2.9, .08, -3.4], linen, .04)
  cylinder(group, .1, .18, [3.4, .09, -2.9], mat('#c9d2c6', .55))
  box(group, [.7, .05, .5], [-.4, .03, -2.5], mat('#d9cdb6', .95), .015)
  label(group, 'NOTES', [-.4, .06, -2.5], .3, '#8a8574')

  const chair = new THREE.Group(); chair.position.set(-2.3, 0, -5.6); chair.rotation.y = .34; group.add(chair)
  box(chair, [1.15, .16, 1.1], [0, .78, 0], mat('#343b38', .9), .07)
  box(chair, [1.1, 1.25, .16], [0, 1.45, -.5], mat('#2d332f', .92), .08)
  cylinder(chair, .07, .68, [0, .4, 0], steel)
  for (let i = 0; i < 5; i++) {
    const leg = box(chair, [.5, .06, .08], [Math.cos(i * 1.257) * .24, .06, Math.sin(i * 1.257) * .24], steel, .02)
    leg.rotation.y = i * 1.257
  }
  box(group, [4.5, 1.7, 4.4], [1.2, -.9, 1.2], mat('#3b352c', .9), .06)
  for (const [x, z] of [[-1.05, -1.0], [3.45, -1.0], [-1.05, 3.4], [3.45, 3.4]]) box(group, [.22, 1.05, .22], [x, -.55, z], darkWood, .03)

  scene.add(group)
  let currentLamp = true, currentCurtains = true
  return {
    update(state: LabState, delta: number) {
      group.visible = state.experience !== 'bench'
      if (!group.visible) return
      const k = reduced ? 1 : 1 - Math.exp(-Math.max(delta, 0) * 4.6)
      leftCurtain.position.x = THREE.MathUtils.lerp(leftCurtain.position.x, state.curtainsOpen ? 1.4 : 3.2, k)
      rightCurtain.position.x = THREE.MathUtils.lerp(rightCurtain.position.x, state.curtainsOpen ? 7.4 : 5.6, k)
      lampLight.intensity = THREE.MathUtils.lerp(lampLight.intensity, state.lampOn ? 2.1 : 0, k)
      shadeMaterial.emissiveIntensity = THREE.MathUtils.lerp(shadeMaterial.emissiveIntensity, state.lampOn ? .5 : .02, k)
      currentLamp = state.lampOn; currentCurtains = state.curtainsOpen
    },
    read() {
      return { visible: group.visible, lampOn: currentLamp, lampIntensity: lampLight.intensity, curtainsOpen: currentCurtains, curtains: [leftCurtain.position.x, rightCurtain.position.x] }
    },
    dispose() {
      scene.remove(group)
      const textures = new Set<THREE.Texture>()
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach(item => { Object.values(item).forEach(value => { if (value instanceof THREE.Texture) textures.add(value) }); item.dispose() })
      })
      textures.forEach(texture => texture.dispose())
    }
  }
}
