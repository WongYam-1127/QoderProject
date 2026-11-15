# 素材与再分发

## 原创资产

- 站点抬头是「WongYam的装机Lab」，显卡的品牌与型号 VOLTA / G01 是本模板的虚构产品标识，不代表现有产品。显卡外形只借用当代旗舰双穿流散热的设计语言，机箱按 mATX 侧透结构建模，几何与标识均为原创。
- 显卡底板 PCB、GPU 核心、散热鳍片、风扇、供电口与金手指，以及 mATX 机箱、IO 挡板、主板、CPU、两条内存、塔式散热器、ATX 电源与排插、显示器、桌面、台灯、窗帘、夜景窗等全部模型细节，均由本项目程序化创建，没有导入商业产品模型或第三方三维资产。
- 工作台字标、电路板丝印、渲染负载测试图、色彩校准图和窗外的城市夜景由 Canvas 绘制。
- 开机与运行音效由 Web Audio 合成，默认关闭，不包含外部音频。
- 原创源码、模型定义和上述原创生成素材按根目录 `LICENSE` 的 MIT 条款提供。
- `cover/` 中的封面与截图均来自实际运行页面，不是生成效果图；画面中的影片帧仍受下述 CC BY 3.0 约束。

## 本地短片

`public/media/atelier-film.mp4` 是 **Big Buck Bunny**（2008）的 15 秒实际电影片段，不是测试图或生成效果图。

- 创作者：Blender Foundation / Peach 项目团队。
- 署名：© 2008 Blender Foundation | www.blender.org
- 官方来源与许可依据：https://peach.blender.org/about/
- 下载镜像：https://media.w3.org/2010/05/bunny/movie.mp4
- 许可：Creative Commons Attribution 3.0 Unported，https://creativecommons.org/licenses/by/3.0/
- 修改：截取原片 00:45–01:00，缩放为 640×360，保留 24 fps，移除音轨，转码 H.264 / MP4。
- 大小：1,600,004 字节；时长 15 秒；360 帧。
- SHA-256：`5dd18b1f83c2dc40c755cdbf1cc77255081c53daf4fa305f40775cb788b32899`

允许随商业或非商业模板修改和再分发，但必须保留合理署名、来源、许可链接与修改说明。请同时保留 `public/media/LICENSE.txt`。帮助弹窗已提供访客可见的署名和本地许可入口。不暗示原作团队为此模板背书。

## 字体和图标

- 使用系统字体，不打包或在线请求字体文件。
- Lucide React 图标：ISC License。版权及原文见依赖包 `lucide-react/LICENSE`。
- Three.js、React、React DOM：MIT License。Vite、TypeScript 及测试工具遵守各自包内许可。
- `package-lock.json` 固定依赖与完整性；没有复制其他站点的资源或部署绑定。
