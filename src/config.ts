export type PartId = 'board' | 'cpu' | 'cooler' | 'dimmA' | 'dimmB' | 'shield' | 'psu' | 'pcb' | 'core' | 'heatsink' | 'fan'
export type Carrier = 'case' | 'card'
export type Vec3 = [number, number, number]
export type PortId = 'A1' | 'A2' | 'E1' | 'E2' | 'G1' | 'G2' | 'C1' | 'C2' | 'F1' | 'F2' | 'D1' | 'D2' | 'M1' | 'M2'
export type WireId = 'atx' | 'eps' | 'pcie' | 'cpufan' | 'fan' | 'dp' | 'mains'
export type DeskView = 'desk' | 'screen' | 'window'
export type Content = 'film' | 'bench' | 'color'
export const BRAND = { name: 'VOLTA', chinese: '装机实验室', product: 'G01', card: '显卡', title: '把算力，亲手焊上去。', subtitle: '一台整机。十一个零件。一次属于你的开机。' }
export const COLORS = { cream: '#e7e4d8', orange: '#2f80ab', ink: '#1d221f', metal: '#7a817b', pcb: '#242b26', desk: '#ccc7bc', smoke: '#84928a', brass: '#c3a271', silicon: '#8fa0a6', graphite: '#343a37' }

export const PARTS: Record<PartId, { number: string; name: string; en: string; group: 'platform' | 'graphics'; carrier: Carrier; description: string; slot: Vec3; home: Vec3; exploded: Vec3; size: Vec3; dependencies: PartId[]; initialAngle: number }> = {
  board: { number: '01', name: 'mATX 主板', en: 'MOTHERBOARD', group: 'platform', carrier: 'case', description: '244×244 主板。对准九颗铜柱，后部 IO 堆栈压进挡板的开口里，先装挡板再落板。', slot: [2.3, .42, -2.15], home: [-6.8, .35, 1.2], exploded: [-1.0, 1.5, -2.2], size: [3.5, .16, 3.5], dependencies: ['shield'], initialAngle: 0 },
  cpu: { number: '02', name: 'CPU 处理器', en: 'PROCESSOR', group: 'platform', carrier: 'case', description: 'LGA 封装。金色三角对插座上的三角缺口，压杆抬起后才能放进力臂槽。', slot: [1.6, .6, -3.0], home: [-3.0, .3, -5.6], exploded: [2.6, 3.3, -2.0], size: [.62, .1, .62], dependencies: ['board'], initialAngle: -Math.PI / 2 },
  cooler: { number: '03', name: 'CPU 散热器', en: 'CPU COOLER', group: 'platform', carrier: 'case', description: '六热敏塔式散热器，风扇朝后部排风。四根内存条先落位，扣具才压得平。', slot: [1.6, 1.3, -3.55], home: [-6.0, .45, -5.0], exploded: [2.4, 4.6, -2.4], size: [1.8, 1.4, 1.7], dependencies: ['cpu', 'dimmA', 'dimmB'], initialAngle: 0 },
  dimmA: { number: '04', name: '内存条 A2', en: 'DIMM A2', group: 'platform', carrier: 'case', description: '金手指的缺口对准第二条槽。两侧卡扣会自己咬住，垂直压到底。', slot: [3.25, .8, -2.9], home: [0.2, .35, -6.0], exploded: [3.9, 2.2, -1.2], size: [.16, .55, 1.5], dependencies: ['board'], initialAngle: 0 },
  dimmB: { number: '05', name: '内存条 B2', en: 'DIMM B2', group: 'platform', carrier: 'case', description: '第四条槽，和 A2 组成双通道。同规格、同朝向。', slot: [3.75, .8, -2.9], home: [1.9, .35, -6.0], exploded: [4.5, 2.9, -2.6], size: [.16, .55, 1.5], dependencies: ['board'], initialAngle: 0 },
  shield: { number: '06', name: 'IO 挡板', en: 'IO SHIELD', group: 'platform', carrier: 'case', description: '后部 IO 挡片。凸缘朝机箱外，卡进后壁的方形开口，装好它主板才落得下去。', slot: [.42, .85, -2.6], home: [3.6, .35, -6.0], exploded: [3.4, 1.6, .4], size: [.1, .62, 2.2], dependencies: [], initialAngle: 0 },
  psu: { number: '07', name: 'ATX 电源', en: 'POWER SUPPLY', group: 'platform', carrier: 'case', description: '全模组电源，风扇面朝下。推入底部电源仓，模组接口朝向主板一侧。', slot: [2.6, 1.15, .25], home: [6.4, .5, -3.4], exploded: [4.3, 4.3, .6], size: [2.3, 2.1, 1.2], dependencies: [], initialAngle: 0 },
  pcb: { number: '08', name: '底板 PCB', en: 'CARRIER BOARD', group: 'graphics', carrier: 'card', description: '整张卡的地基，黑色双层板。对齐底座上的四个铜色定位柱，金手指朝前。', slot: [-2.6, .3, .4], home: [-4.0, .26, -2.2], exploded: [-2.9, 1.9, .6], size: [3.9, .12, 1.75], dependencies: [], initialAngle: 0 },
  core: { number: '09', name: 'GPU 核心', en: 'GPU DIE', group: 'graphics', carrier: 'card', description: '硅片与基板。天青缺口朝向金手指一侧，必要时旋转 90°。焊上去之前，它还只是放着。', slot: [-2.32, .42, .38], home: [-1.9, .3, -3.6], exploded: [-1.6, 3.1, .3], size: [1.15, .13, 1.15], dependencies: ['pcb'], initialAngle: -Math.PI / 2 },
  heatsink: { number: '10', name: '散热鳍片', en: 'HEAT SINK', group: 'graphics', carrier: 'card', description: '双面穿流鳍片组：中置风道、压铸框与下侧风扇。只有在核心回流焊完成之后才能压下。', slot: [-2.32, .66, .4], home: [-3.2, .5, 4.4], exploded: [-3.2, 4.2, -.2], size: [3.15, .34, 1.55], dependencies: ['core'], initialAngle: 0 },
  fan: { number: '11', name: '散热风扇', en: 'COOLING FAN', group: 'graphics', carrier: 'card', description: '上侧风扇面板，十一叶轴流风扇压在鳍片之上。天青接线端子朝向 PCB 尾部的风扇针脚。', slot: [-2.32, .92, .4], home: [-1.0, .3, -6.2], exploded: [-1.9, 5.3, .5], size: [3.35, .18, 1.62], dependencies: ['heatsink'], initialAngle: -Math.PI / 2 }
}
export const PART_IDS = Object.keys(PARTS) as PartId[]
export const PLATFORM_IDS = PART_IDS.filter(id => PARTS[id].group === 'platform')
export const GRAPHICS_IDS = PART_IDS.filter(id => PARTS[id].group === 'graphics')

export const PORTS: Record<PortId, { owner: PartId | 'external'; local: Vec3; name: string; shape: 'square' | 'round'; color: string; when: 'any' | 'bench' | 'mounted' }> = {
  A1: { owner: 'psu', local: [.75, -.25, -.62], name: '电源 · 24-pin ATX 输出', shape: 'square', color: '#b1bdb1', when: 'any' },
  A2: { owner: 'board', local: [1.62, .13, .05], name: '主板 · 24-pin ATX 插座', shape: 'square', color: '#d5d0c4', when: 'any' },
  E1: { owner: 'psu', local: [-.35, -.3, -.62], name: '电源 · CPU 8-pin 输出', shape: 'square', color: '#b1bdb1', when: 'any' },
  E2: { owner: 'board', local: [-1.35, .13, -1.45], name: '主板 · EPS 8-pin 插座', shape: 'square', color: '#d5d0c4', when: 'any' },
  G1: { owner: 'psu', local: [.2, .35, -.62], name: '电源 · PCIe 8-pin 输出', shape: 'square', color: '#b1bdb1', when: 'any' },
  G2: { owner: 'pcb', local: [1.65, .04, .82], name: '显卡 · 12V-2x6 供电口', shape: 'square', color: '#b1bdb1', when: 'mounted' },
  C1: { owner: 'board', local: [0, .08, -1.55], name: '主板 · CPU_FAN 针脚', shape: 'square', color: '#eb8049', when: 'any' },
  C2: { owner: 'cooler', local: [.55, -.53, .2], name: '散热器 · 风扇端子', shape: 'square', color: '#eb8049', when: 'any' },
  F1: { owner: 'pcb', local: [-1.65, .1, .55], name: '底板 · 风扇针脚', shape: 'square', color: '#eb8049', when: 'bench' },
  F2: { owner: 'fan', local: [-1.53, .1, .65], name: '风扇 · 供电端子', shape: 'square', color: '#eb8049', when: 'bench' },
  D1: { owner: 'pcb', local: [-1.9, .84, .02], name: '显卡 · DisplayPort 输出', shape: 'square', color: '#8fa0a6', when: 'mounted' },
  D2: { owner: 'external', local: [.62, 1.4, 3.26], name: '显示器 · DisplayPort 输入', shape: 'square', color: '#8fa0a6', when: 'any' },
  M1: { owner: 'psu', local: [-1.2, -.3, .1], name: '电源 · 市电输入', shape: 'round', color: '#454c48', when: 'any' },
  M2: { owner: 'external', local: [5.75, .35, 1.6], name: '桌面 · 市电插座', shape: 'round', color: '#454c48', when: 'any' }
}
export const PORT_IDS = Object.keys(PORTS) as PortId[]

export const WIRES: Record<WireId, { ends: [PortId, PortId]; name: string; internal: boolean; route: Vec3[]; color: string }> = {
  atx: { ends: ['A1', 'A2'], name: '24-pin 主板供电线', internal: false, route: [[3.6, .78, -.42], [3.95, .72, -1.1], [4.02, .6, -1.75]], color: '#3d4440' },
  eps: { ends: ['E1', 'E2'], name: 'CPU 8-pin 供电线', internal: false, route: [[2.1, .8, -.42], [1.3, .74, -1.6], [.95, .66, -2.9]], color: '#403e39' },
  pcie: { ends: ['G1', 'G2'], name: '显卡供电线', internal: false, route: [[2.9, 1.42, -.4], [3.6, 1.72, -.5], [4.1, 2.02, -.56]], color: '#403e39' },
  cpufan: { ends: ['C1', 'C2'], name: 'CPU 风扇线', internal: false, route: [[2.24, .76, -3.44], [2.3, .6, -3.6]], color: '#d97743' },
  fan: { ends: ['F1', 'F2'], name: '显卡风扇线', internal: true, route: [[-4.28, .54, 1.06], [-4.2, .82, 1.24], [-3.98, 1.04, 1.16]], color: '#d97743' },
  dp: { ends: ['D1', 'D2'], name: 'DisplayPort 线', internal: false, route: [[.5, 1.0, -.6], [.42, .5, 1.2], [.5, 1.1, 2.6]], color: '#2b312e' },
  mains: { ends: ['M1', 'M2'], name: '电源线', internal: false, route: [[1.4, .7, .9], [2.9, .3, 1.5], [4.6, .3, 1.62]], color: '#23282a' }
}
export const WIRE_IDS = Object.keys(WIRES) as WireId[]

export const ASSEMBLY = { snapDistance: .62, mountSnapDistance: 1.55, angleTolerance: .2, targetAngle: 0 }
export const SOLDER = { ambient: 26, target: 200, ceiling: 275, max: 300, ramp: 78, cooling: .22, drift: 8, dwell: 2.6, overheat: 22, head: [-2.32, 1.5, .4] as Vec3 }
export const MOUNT = { position: [5.16, .97, -.25] as Vec3, rotation: [-Math.PI / 2, 0, 0] as Vec3, slot: [1.55, 1.05, -.55] as Vec3, grip: [-2.6, .66, .4] as Vec3 }
export const CASE = { shell: [2.65, 1.5, -2.0] as Vec3, size: [4.8, 3.0, 5.7] as Vec3, intake: [4.6, 1.5, -1.9] as Vec3 }
export const DISPLAY = { panel: [1.2, 2.02, 3.02] as Vec3, width: 3.6, height: 2.025, glow: [1.2, 2.02, 2.5] as Vec3, imageSweetSpot: 92 }
export const DESK = {
  views: {
    desk: { camera: [-1.6, 3.3, -9.6] as Vec3, mobile: [-3.4, 3.3, -5.4] as Vec3, target: [0.2, 1.9, 3.2] as Vec3, mobileTarget: [1.9, 2, 3.1] as Vec3 },
    screen: { camera: [1.2, 2.1, -4.1] as Vec3, mobile: [1.2, 2.2, -3.4] as Vec3, target: [1.2, 2.02, 3.1] as Vec3, mobileTarget: [1.2, 2.02, 3.1] as Vec3 },
    window: { camera: [4.5, 3.1, -3.2] as Vec3, mobile: [5.4, 3.4, -2.4] as Vec3, target: [4.4, 3.5, 6.2] as Vec3, mobileTarget: [4.4, 3.5, 6.2] as Vec3 }
  },
  cinema: { camera: [1.2, 2.04, -2.6] as Vec3, mobile: [1.2, 2.1, -2.2] as Vec3, target: [1.2, 2.02, 3.2] as Vec3 },
  anchors: { lamp: [-4.5, 1.5, 2.6] as Vec3, curtains: [4.4, 3.6, 6.1] as Vec3, screen: [1.2, 2.02, 3.2] as Vec3 }
}
export const MEDIA = { film: './media/atelier-film.mp4', filmTitle: '林间片刻', filmSubtitle: 'Big Buck Bunny · 本地短片', gridTitle: '渲染负载测试图', colorTitle: '色彩校准图' }

export const COPY = {
  header: {
    title: 'WongYam的装机Lab', steps: ['装机', '装卡', '焊接', '接线', '上机', '点亮'], edition: 'FULL SYSTEM BUILD',
    soundOff: '关闭声音', soundDefaultOff: '声音默认关闭', powerOn: '开机', powerOff: '关机'
  },
  hero: {
    title: { firstLine: '把算力', secondLine: '亲手焊上去' },
    start: '开始组装'
  },
  scene: {
    placeHere: '放入此处', mountHere: '插入 PCIe 插槽', holdHeat: '按住加热', heatRelease: '松开停止',
    firstLight: 'YOUR FIRST FRAME', workshop: (index: number) => `WORKSHOP / 0${index}`,
    arranging: '零件正在工作台上就位…', hint: '提示位置', resetView: '复位视角', resetAssembly: '重新组装', assembly: 'BUILD',
    backToBench: '从主板上取下'
  },
  selection: { retrieve: '取回工作台', rotate: '旋转 90°' },
  dock: {
    parts: '组件', wires: '接线',
    platform: '平台', graphics: '显卡',
    desktop: { parts: '拖拽零件就位 · R 旋转方向', wires: '点起点 → 点终点，或直接把线拖过去' },
    touch: { parts: '选择组件 → 点安装槽', wires: '点起点 → 点终点' },
    installed: '已就位', pending: '待安装', disconnect: '断开', pendingConnection: '待连接',
    resize: '拖动或按上下键调节面板高度'
  },
  solder: {
    eyebrow: 'REFLOW STATION', title: '回流焊 GPU 核心', idle: '按住加热，让焊锡熔化。', noCore: '先把 GPU 核心放上底板 PCB。',
    heating: '正在升温…接近 275°C 就松手。', soak: '预热中，继续加热到回流点。', reflow: '已进入回流窗口：短按短放，把温度留在区间里。',
    done: '焊点已凝固，核心与 PCB 成为一张卡。', overheat: '温度过高！立即松手，焊盘正在受损。',
    temperature: '温度', window: '回流窗口', progress: '回流进度', locked: '核心退回工作台，焊点作废，需要重新回流。',
    finish: '回流完成', damage: '过热记录'
  },
  mount: {
    eyebrow: 'PCIE X16 SLOT', title: '把整张卡插进主板', detail: '机箱里的主板已装好，装配与风扇接线完成后，拖动显卡，让金手指对准 PCIe 插槽。',
    ready: '整卡可以拿起', dragging: '对准插槽，松手插入', seated: '显卡已就位，卡扣已锁上。', needSolder: '先完成 GPU 核心回流焊。', needFanWire: '先接好显卡风扇线。', needParts: '先把四个显卡组件装完。', needBoard: '先把主板装进机箱。',
    lift: '显卡已退回工作台。'
  },
  display: { generated: '程序生成 · 测试图案', film: '短片', grid: '测试图', color: '色彩', brightness: '亮度', contrast: '对比度', sharpness: '清晰度' },
  desk: {
    entry: { eyebrow: 'A SCREEN FOR YOUR SILICON', title: '把这台机器，带回桌面', detail: '机箱已经装完，线都在里面。台灯、窗帘和屏幕都由你决定。', action: '进入桌面' },
    eyebrow: 'DESK / NIGHT 01', hint: 'A / D 或左右按钮探索 · 点击发光标记与桌面互动',
    returnWorkshop: '返回工作台', watch: '坐下观影', leaveCinema: '起身看看', lampOn: '关掉台灯', lampOff: '点亮台灯', curtainsOpen: '拉上窗帘', curtainsClosed: '打开窗帘',
    views: {
      desk: { title: '桌面上的整机', detail: '机箱、显示器和电源排插在同一张桌上，随时可以拆回来。' },
      screen: { title: '今晚，由你点亮这块屏', detail: '你焊好的核心就在身后。选好画面，坐下来。' },
      window: { title: '夜色刚刚好', detail: '拉上窗帘，让屏幕的色彩再准一点。' }
    }
  },
  footer: {
    safety: '低压装配演示，非电器维修指南', completed: '亲手装完，所以与众不同。', navigation: '空白处旋转 · 双指 / 滚轮缩放'
  },
  fallback: {
    eyebrow: 'WEBGL NOT AVAILABLE', title: '这台机器，需要 3D 支持。',
    browser: '当前浏览器无法建立 WebGL 场景。请开启硬件加速，或使用支持 WebGL 2 的新版 Chrome、Safari、Firefox。',
    experience: `${BRAND.name} ${BRAND.product} 是一个十一组件低压装机演示。完整体验需要实时 3D，兼容模式不会伪造装配或输出画面。`,
    retry: '重新尝试'
  },
  reset: { eyebrow: 'A FRESH START', title: '再装一次？', detail: '所有零件、焊点、线路、机箱内状态、画面参数与播放进度都会复原。', confirm: '重新开始' },
  help: {
    eyebrow: 'A LITTLE GUIDANCE', title: '慢慢来，焊点会等你。',
    steps: [
      { number: '01', title: '把平台装进机箱', detail: '先卡 IO 挡板，再落主板（九颗铜柱定位）。抬压杆放 CPU，金色三角对缺口；两条内存走 A2、B2 组双通道，最后压上塔式散热器。电源推进底部电源仓。' },
      { number: '02', title: '装卡，然后焊接', detail: '底板 PCB → GPU 核心（天青缺口朝金手指）→ 回流焊 → 鳍片 → 风扇。按住加热把温度停在 200–275°C，进度堆满才算焊住，超温会退回进度。' },
      { number: '03', title: '接线、上机、点亮', detail: 'C1↔C2 接 CPU 风扇，F1↔F2 接显卡风扇，A1↔A2 是 24-pin，E1↔E2 是 CPU 8-pin，G1↔G2 供显卡电，D1↔D2 走 DisplayPort，M1↔M2 是电源线。金手指插入 PCIe 后才能开机：电源灯 → 风扇 → 背光 → 画面。' }
    ],
    brandCredit: '虚构品牌 / 原创程序化模型', safety: '这是简化的低压装配体验，不是市电接线、焊接或维修指南。',
    filmCredit: '影片：Big Buck Bunny © 2008 Blender Foundation', filmLicense: 'CC BY 3.0 · 已截取、缩放与静音', licenseLink: '查看素材来源与再分发许可 ↗'
  },
  steps: {
    platform: { title: '十一个零件，装成一台机器', hint: '机箱在画面左侧。先卡 IO 挡板，再落主板，然后 CPU、内存、散热器与电源。' },
    assembly: { title: '四个零件，叠成一张卡', hint: '先放底板 PCB，再放 GPU 核心。天青标记告诉你正确的方向。' },
    soldering: { title: '加热，让核心真的长在上面', hint: '按住加热，把温度送进 200–275°C 的回流窗口；接近上限就松手，进度堆满才算焊住。' },
    wiring: { title: '把线一根根接到位', hint: 'A/E/G/C/F 是供电与风扇，D 是 DisplayPort，M 是电源线。字母相同、编号不同才是一对。' },
    power: { title: '插卡、合箱，准备开机', hint: '金手指插入 PCIe 插槽，接上显卡供电与显示器信号线，一切就绪。' },
    projecting: { title: '让算力，有了画面', hint: '调一调亮度、对比度与清晰度，找到属于你的清晰。' }
  },
  rules: {
    installation: {
      powered: '主机正在通电。请先关机，再操作零件。', installed: '这个零件已经安装，无需重复放置。', seating: '零件正在吸附到位，请稍候。', mounted: '显卡已经插在 PCIe 插槽里。请先把它取回工作台。',
      boardRemoved: '主板还在机箱里。先把它取回工作台，才能拆装后面的零件。',
      dependencies: (names: readonly string[]) => `请先安装${names.join('、')}。`,
      unsoldered: `请先完成${PARTS.core.name}的回流焊，再安装${PARTS.heatsink.name}。`
    },
    placement: { slot: '这里不是它的安装槽。靠近对应轮廓后再松手。', angle: '方向还没对齐。旋转零件，让天青标记与槽位标记一致。' },
    mounting: {
      distance: '金手指没有对上 PCIe 插槽。把整张卡移到插槽上方再松手。',
      incomplete: (detail: string) => `还不能上机：${detail}。`
    },
    connection: {
      powered: '请先关机。通电时不能连接或改动线路。', samePort: '不能把接口连接到自身，请选择另一端。',
      unavailable: '接口尚不可用：先装好对应组件，并让显卡插进 PCIe 插槽。',
      incompatible: (a: PortId, b: PortId) => `接口不兼容：${a}（${PORTS[a].name}）不能连接 ${b}（${PORTS[b].name}）。相同字母、不同编号才匹配。`,
      connected: '这组接口已经连接；如需重接，请先断开对应线路。'
    },
    power: {
      install: (name: string) => `安装${name}`,
      solder: `完成${PARTS.core.name}回流焊`,
      connect: (id: WireId) => `连接${WIRES[id].name}（${WIRES[id].ends.join(' ↔ ')}）`,
      mount: `把显卡插入主板 PCIe 插槽`
    }
  },
  feedback: {
    initial: { title: '从一只空机箱开始', detail: `先把${PARTS.shield.name}卡进后壁，再把${PARTS.board.name}放上铜柱。` },
    assemblyLocked: { title: '先关机，再拆装', detail: '开机期间，零件、焊点与线路已锁定。' },
    installed: '已安装。关机并断开关联线路后，可取回工作台。',
    rotated: { title: '方向已旋转 90°', detail: '让零件上的天青标记，与安装槽的标记对齐。' },
    placementFailed: '还差一点', seating: '正在就位',
    seated: { title: (name: string) => `${name}，已就位`, core: '核心只是放着。到右侧回流焊台把它焊住。', detail: '精确的连接，令人安心。', cpu: '压杆落下，触点才算数。', board: '九颗铜柱都吃住了螺丝。' },
    removalPowered: '通电时不允许拆卸组件。',
    disconnectFirst: { title: '先断开关联线路', detail: (wire: string, part: string) => `请先断开${wire}，再取出${part}。` },
    removeDependent: { title: '先取下上层组件', detail: (name: string) => `请先取下${name}。` },
    removed: { title: (name: string) => `${name}已取回`, detail: '可以重新调整方向并安装。' },
    shutdownFirst: '请先关机', wiresLocked: '通电时线路已锁定。',
    portUnavailable: { title: '接口暂不可用', detail: '先装好对应组件；显卡的供电口与 DP 口要等它插进 PCIe。' },
    portSelected: { title: (id: PortId) => `已选择 ${id} · ${PORTS[id].name}`, detail: '拖向或点选同字母的另一端；Escape 取消。' },
    connectionFailed: '线路未连接', connected: (a: PortId, b: PortId) => `${a} ↔ ${b}，连接完成`,
    disconnectPowered: '通电时不能断开线路。',
    mountFirst: { title: '先把显卡取回工作台', detail: '内部线路藏在压铸框下面，下机之后才能改动。' },
    unmount: { title: '先把显卡从主板上取下', detail: '整卡还插在 PCIe 插槽里，下机之后才能拆装零件。' },
    disconnected: { title: (name: string) => `${name}已断开`, detail: '选择两个兼容接口即可重新连接。' },
    heating: { title: '回流加热中', detail: '温度进入回流窗口后，进度才会开始累加。' },
    overheated: { title: '过热！松开加热', detail: '温度超过上限，回流进度正在退回。真实焊接会损坏焊盘，这里只做提示。' },
    soldered: { title: '回流完成', detail: '焊点已凝固。现在可以压下散热鳍片了。', already: '这张卡已经焊好了。' },
    mountBlocked: { title: '还不能上机', detail: (reason: string) => `${reason}`, },
    mounted: { title: '显卡已插入主板', detail: '卡扣锁上。接上 G1 ↔ G2 与 D1 ↔ D2，就可以开机。' },
    unmounted: { title: '显卡已退回工作台', detail: '内部风扇线现在可以重新连接。' },
    cardLocked: { title: '先完成装配', detail: '四个显卡组件全部就位后，才能拿起整张卡。' },
    poweredOff: { title: '已关闭主机', detail: '风扇停止，画面熄灭。现在可以安全地拆装。' },
    powerMissing: {
      title: (count: number) => `暂时无法开机 · 缺少 ${count} 项`,
      detail: (first: string, remaining: readonly string[]) => `${first}。${remaining.length ? '还需：' + remaining.join('；') : ''}`
    },
    booting: { title: '正在点亮你的作品', detail: '市电 → 电源灯 → 风扇 → 主板通电 → 显卡灯效 → 屏幕背光 → 画面' },
    booted: { title: '你的第一帧，已抵达', detail: '拖动底部滑杆，让画面从朦胧走向清晰。' },
    hint: { title: '留意天青定位轮廓', detail: (name: string) => `${name}的位置已标出。需要你自己把它放过去。` },
    mediaError: { title: '短片未能载入', detail: '请检查本地 media 目录。测试图与色彩图案仍可使用。' },
    playbackBlocked: { title: '影片等待播放', detail: '浏览器暂停了自动播放。点击播放按钮继续。' }
  }
} as const
