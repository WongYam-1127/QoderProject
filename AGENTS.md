# AGENTS.md

面向在本仓库工作的 coding agent。给人看的说明读 [README.md](README.md)，验证事实读 [VERIFICATION.md](VERIFICATION.md)，素材授权读 [ASSETS.md](ASSETS.md)。

## 上手

```sh
npm ci            # Node >= 22.18（npm test 依赖 --experimental-strip-types 直接跑 .ts）
npm run dev       # http://127.0.0.1:4408/
npm test          # 纯规则测试，无浏览器依赖，任何环境可跑
npm run build     # tsc -b && vite build，产出 dist/
npm run test:browser   # 197 项三路径浏览器闭环，需要本机 Chrome
```

`dev` 与 `preview` 共用 4408 端口，起预览前先停 dev。`test:browser` 默认取 `C:/Program Files/Google/Chrome/Application/chrome.exe`，其他系统用 `CHROME_PATH` 指定；headless 必须带 `--use-angle=d3d11`（脚本里已写死）。同一时间只跑一个浏览器闭环：两个实例会抢 GPU 并交叉写同一份日志，产出假失败。

## 分层契约

改动要先落到正确的层，跨层复制逻辑是本项目最主要的腐化来源。

- `src/config.ts` — 只有数据与文案：零件/接口/线缆定义、坐标、依赖表、`SOLDER`/`MOUNT` 常量、`COLORS`、`COPY`。不放判断。
- `src/state.ts` — 规则的唯一来源：依赖门控、朝向容差、回流物理、上机前置、开机预检、进度。所有用户反馈经由单一出口 `tell()`。
- `src/scene.ts` — Three.js 场景、引导式相机、射线拾取、拖放、标记可见性与竖屏相机引导。
- `src/models.ts` / `src/platform.ts` / `src/desk.ts` — 程序化几何（显卡四件套与显示器 / 机箱与主板 / 电脑桌与窗景）。
- `src/projection.ts` — 屏幕着色器（模糊、锐化、亮度、对比度、暗角、扫描线）、开机时序。
- `src/main.tsx` / `src/style.css` — React 界面与样式。样式表是"一条规则一行"的密集排版，按媒体查询分段；配色只认 `--site-accent`，改色带不要逐处替换十六进制。

## 已踩实的坑

- **反馈只能由状态跳变触发**。`tick()` 里每帧 `tell()` 会覆盖上一条提示（曾经吞掉"接口不兼容"报错）。写提示先问：这是跳变还是持续态？
- **竖屏标记锚点用 `anchor('mount')`**。PCIe 标记锚在主板插槽 `MOUNT.slot`，而显卡组落位点是 `MOUNT.position`，两者相差 3.6 米；对齐后者会让相机把空白摆到画面正中、标记依旧出画。
- **竖屏相机引导只在 `宽/高 < 0.9` 生效**，横屏与桌面机位不变；接口标记只在"接线"页渲染，所以接完卡内风扇线要切回"组件"页才能点到 PCIe 标记。测试里点标记前必须先 `settle()` 等相机停稳。
- **不要靠放大容差修手感**。吸附距离、朝向容差、回流窗口都写在 `ASSEMBLY`/`SOLDER`，放宽它们等于放宽规则本身；先查交互与提示。
- **阈值要按实际素材推导**。屏幕锐度测试的最大模糊值来自片源高度（`softness^1.15 * 14 * height / 360`，当前 640×360 → 上限 14）；沿用投影仪模板时代 720p 的 28 会误判成 bug。

## 禁区

- 不复用、不提交任何模板遗留标识：`*.qoder.site` 是本站点的云端私有绑定，`TEMPLATE-DISABLED.site-descriptor.json` 带着历史 projectId / siteId / actionId，两者已在 `.gitignore` 中，不要移出去。需要新站点时让工具生成全新身份。
- 没有用户明确要求，不做站点注册、准备或发布；本地预览与调试是默认交付形态。
- 不为了让测试变绿而删断言或改成 `catch(() => false)`。修根因，或把该项的作用域如实收窄（例如整卡物理拖拽只在桌面路径断言，触屏走标记插入）。
- 不在仓库里放密钥、`.env` 或真实凭据；不要提交 `tsconfig.tsbuildinfo`、`.preview-*/`。

## 提交前

1. `npm test` 通过；改动涉及界面或规则时补跑 `npx tsc --noEmit`。
2. 影响视觉或交互时跑 `npm run test:browser`，确认 `status: passed` 且控制台错误为 0，再把检查数同步进 `VERIFICATION.md`。
3. 行尾统一 LF（见 `.gitattributes`）；样式表保持单行密集写法。
