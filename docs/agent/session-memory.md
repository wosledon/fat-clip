# Session Memory

## Current Goal
- 修复设置保存、亚克力透明效果、手动清理排版与 Git graph 时间线

## Scope Guardrails (Out of Scope)
- 本轮不重构设置页数据模型（`Settings.tsx` 与 Rust `Settings` 字段对齐问题后续单独处理）。

## Decisions (with rationale)
- [D-002] 决策：剪贴监听改为 Rust 后端常驻线程轮询系统剪贴板，并通过事件 `clipboard-updated` 通知前端刷新。
  - 原因：前端窗口隐藏时轮询可能失效，导致“新复制内容不显示”。
  - 备选：继续仅依赖前端 `ClipboardListener`。
  - 影响：监听与入库不再依赖主窗口可见状态。
- [D-003] 决策：输入面板 `Ctrl+1~9` 改为后端全局键盘监听发事件，前端执行粘贴。
  - 原因：输入面板不聚焦时前端 `keydown` 无法可靠捕获。
  - 备选：仅在前端监听键盘事件。
  - 影响：小窗在隐藏主窗口场景下可直接切换并粘贴。
- [D-004] 决策：将 capability 授权覆盖 `input-panel` 窗口。
  - 原因：Tauri v2 下未授权窗口调用 `invoke` 会失败，表现为输入面板空白或不可粘贴。
  - 备选：为输入面板单独创建 capability 文件。
  - 影响：输入面板可调用 `get_recent_clips` / `paste_and_cleanup` 等命令。
- [D-005] 决策：输入面板功能临时下线，后端强制 `enable_input_panel = false`，设置页隐藏并禁用入口。
  - 原因：当前 `Ctrl+数字` 与目标应用快捷键/焦点机制存在冲突，影响稳定性。
  - 备选：继续在线修复焦点与全局按键冲突。
  - 影响：该功能后续重构后再重新开放。
- [D-006] 决策：时间线的 compact 模式改为单列 Git 风格（左侧时间轴 + 右侧内容嵌入同列）。
  - 原因：减少左右分栏占用，提升密度。
  - 备选：保持双栏，仅缩窄左栏。
  - 影响：仅影响紧凑模式的主列表布局。

## Progress
- Done:
  - 后端新增主窗口可见性命令 `is_main_window_visible`。
  - 后端新增常驻剪贴板监听并发出 `clipboard-updated` 事件。
  - 输入面板后端补齐 `Ctrl+1~9` 事件 `input-panel-select-index`。
  - 修复输入面板错误自动隐藏逻辑（输入查询后不再瞬间消失）。
  - 前端输入面板支持后端选择事件、动态 trigger 长度与粘贴后条件通知。
  - 前端 Home 改为监听 `clipboard-updated` 刷新，不再依赖窗口内轮询组件。
  - 通知策略改为“窗口隐藏且通知开关开启”才发送。
  - capability 从仅 `main` 扩展到 `main` + `input-panel`，修复输入面板命令调用权限。
  - 输入面板前端改为稳定订阅（ref 持有最新状态），降低事件重绑造成的空白/失效概率。
- In Progress:
- Next:
  - 实机验证设置保存、主题透明效果、手动清理排版与 Git graph 时间线。
- In Progress:
  - 无

- Next:
  - 在 Windows 实机验证：
    1) 复制新文本后历史自动出现；
    2) 隐藏主窗口时 `Ctrl+1~9` 切换并看到通知；
    3) 输入面板输入检索词后不自动消失。

## Blockers
- 无。

## Risks / Assumptions
- 假设 `rdev` 在当前权限下可捕获全局按键（部分应用可能仍需管理员权限）。

## Handoff (Latest First)
### 2026-02-19 22:25
- 本次完成：
  - 修复 `src-tauri/src/clipboard_monitor.rs` 中 2 处 `clippy::manual_map`（`strip_prefix` 后手动返回 `Some/None` 改为 `Option::map`）。
  - 已执行并通过：`cargo clippy --all-targets -- -D warnings`。
- 未完成：
  - 无。
- 下一步：
  - 继续观察 GitHub Actions 多平台 job 是否有平台特定告警。
- 关键文件：
  - src-tauri/src/clipboard_monitor.rs

### 2026-02-19 12:10
- 本次完成：
  - 修复 Rust `-D warnings` 下的 11 个编译/Clippy 报错：未使用变量、未使用函数、`manual_strip`、`needless_borrows_for_generic_args`、`unnecessary_cast`。
  - 通过条件编译清理平台特定未使用代码（Linux 构建不再触发图像/HTML 相关未使用告警）。
  - 已执行并通过：`cargo clippy --all-targets -- -D warnings`。
- 未完成：
  - 未运行前端或端到端交互测试（本轮仅针对 Rust 编译与 lint）。
- 下一步：
  - 如需更高置信度，可执行 `cargo test` 与一次 `npm run tauri build` 全链路验证。
- 关键文件：
  - src-tauri/src/clipboard_monitor.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/input_panel.rs
  - src-tauri/src/db.rs

### 2026-02-19 11:30
- 本次完成：
  - 进一步补齐 Linux workflow 依赖一致性：`CI build-test(ubuntu)` 与 `Release build-linux` 同步增加 `pkg-config` 与 `libglib2.0-dev`。
- 未完成：
  - 尚未在远端 Actions 运行结果中确认（需 push 后观察）。
- 下一步：
  - 推送后检查 `CI / build-test (ubuntu-latest)` 与 `Release / build-linux` 是否稳定通过。
- 关键文件：
  - .github/workflows/ci.yml
  - .github/workflows/release.yml

### 2026-02-19 11:20
- 本次完成：
  - 修复 Linux CI 中 `glib-sys/gobject-sys` 构建失败：在 `rust-check` job 增加 Ubuntu 系统依赖安装（`pkg-config`、`libglib2.0-dev` 及 Tauri Linux 依赖）。
- 未完成：
  - 尚未在 GitHub Actions 实际运行结果中二次确认（本地仅完成工作流文件修复）。
- 下一步：
  - 推送后观察 `CI / rust-check`，确认不再出现 `glib-2.0.pc` 与 `gobject-2.0.pc` 缺失错误。
- 关键文件：
  - .github/workflows/ci.yml

### 2026-02-19 10:00
- 本次完成：
  - 新增 `npm run icon:generate`，统一从 `src-tauri/icons/icon.svg` 生成全部平台图标。
  - README 补充“修改 Tauri 应用图标与安装包图标”步骤。
  - 已执行图标生成命令并成功产出 `icon.ico` / `icon.icns` / PNG / Appx / iOS / Android 资源。
- 未完成：
  - 未执行安装包视觉人工验收（仅完成资源生成与命令验证）。
- 下一步：
  - 运行 `npm run tauri build` 并检查 Windows 安装包与应用 EXE 图标显示是否符合预期。
- 关键文件：
  - package.json
  - README.md
  - src-tauri/icons/icon.svg

### 2026-02-19 08:25
- 本次完成：
  - 使用新附件风格（橙色瓶身）重绘 SVG 图标并替换前端与 Tauri 图标源。
  - 重新生成了 `src-tauri/icons` 全套平台图标文件。
- 未完成：
  - 未做安装包视觉验收（仅完成资源替换与构建验证）。
- 下一步：
  - 如需验收安装包图标，可直接执行 `npm run tauri build` 并检查托盘/安装程序图标。
- 关键文件：
  - public/app-icon.svg
  - src-tauri/icons/icon.svg

### 2026-02-19 08:05
- 本次完成：
  - 新增产品 SVG 图标并应用到前端标题栏。
  - 使用 `npx tauri icon src-tauri/icons/icon.svg` 重建了 `src-tauri/icons` 下的全套打包图标（ICO/ICNS/PNG 等）。
- 未完成：
  - 未做安装包级别的视觉验收截图（图标资源已更新）。
- 下一步：
  - 若需要，我可以直接触发一次 `npm run tauri build` 产物校验托盘/安装包图标。
- 关键文件：
  - public/app-icon.svg
  - src-tauri/icons/icon.svg
  - src/components/TitleBar.tsx

### 2026-02-19 07:40
- 本次完成：
  - 主页面紧凑时间线：缩小日期左侧占位与组间距，减小剪贴项间距。
  - 标签页面：修复每项标题显示，改为首行短预览（超长省略）并支持悬停查看完整文本。
- 未完成：
  - 未引入可配置的“每组间距密度”设置项。
- 下一步：
  - 如需更紧凑，可继续把卡片内边距与操作按钮宽度下调。
- 关键文件：
  - src/pages/Home.tsx
  - src/pages/Tags.tsx

### 2026-02-19 07:25
- 本次完成：
  - 标签页条目改为手风琴风格（Accordion）：默认展示预览+时间，展开查看完整内容与标签。
  - 调整了副标题与正文间距，列表整体从紧凑改为更易读的间隔。
- 未完成：
  - 目前为单项展开（一次只展开一个条目），未提供“多项同时展开”开关。
- 下一步：
  - 如需多项同时展开，可把 `expandedClipId` 改为 `Set<string>` 管理。
- 关键文件：
  - src/pages/Tags.tsx

### 2026-02-19 07:05
- 本次完成：
  - 标签页条目副标题从来源字段切换为创建时间显示，移除 `Unknown` 来源/用户名观感。
- 未完成：
  - 时间格式目前使用系统 `toLocaleString()`，未做统一格式化配置。
- 下一步：
  - 如需统一格式，可按 i18n 语言改为“相对时间 + 绝对时间 tooltip”。
- 关键文件：
  - src/pages/Tags.tsx

### 2026-02-19 06:50
- 本次完成：
  - 修复剪贴项超宽导致横向滚动条：文本区增加 `minWidth: 0`，详情代码块启用 `overflowWrap: anywhere`，主列表改为仅纵向滚动。
- 未完成：
  - 未在超长无空格文本（如超长 URL/Token）下做人工极限视觉验收。
- 下一步：
  - 若仍有个别条目横向溢出，可进一步对卡片外层增加 `maxWidth: 100%` 与 `contain: layout` 限制。
- 关键文件：
  - src/pages/Home.tsx

### 2026-02-19 06:35
- 本次完成：
  - 紧凑时间线移除括号包裹与 Git 样式，仅保留日期标题与日期之间连线。
  - 设置页时间线选项文案移除 Git 说明，统一为“紧凑时间线 / Compact Timeline”。
- 未完成：
  - 未做 UI 截图对齐检查（已完成编译验证）。
- 下一步：
  - 如需进一步简化，可去掉日期右侧“条数”显示。
- 关键文件：
  - src/pages/Home.tsx
  - src/i18n/locales/zh.json
  - src/i18n/locales/en.json

### 2026-02-19 06:20
- 本次完成：
  - 修复紧凑时间线按天分组的“括号式包裹”渲染：每个日期组使用顶部/底部横向钩子 + 竖线，形成更接近 Git graph 的日分组视觉。
  - 修复设置保存 `os error 2`：自动启动开关失败改为记录日志，不再阻断配置写入流程。
- 未完成：
  - 未在用户机器上做交互验收（仅完成本地构建与 Rust check）。
- 下一步：
  - 用户侧验证：切换时间线为 compact 检查每日包裹效果；在设置页保存配置确认不再报错。
- 关键文件：
  - src/pages/Home.tsx
  - src-tauri/src/lib.rs

### 2026-02-19 23:59
- 本次完成：
  - 紧凑时间线改为多列 Git graph 风格（多列轨道 + 横向连接）。
  - 设置保存改为合并原始配置，避免缺失字段导致保存失败。
  - 手动清理表单改为网格布局并提升按钮尺寸。
  - 亚克力主题基底改为透明以提升透视效果。
- 未完成：
  - 未验证保存错误提示与透明主题在各系统的表现。
- 下一步：
  - 实机确认保存可用、透明效果与手动清理布局。
- 关键文件：
  - src/pages/Home.tsx
  - src/pages/Settings.tsx
  - src/main.tsx
### 2026-02-19 23:59
- 本次完成：
  - 输入面板功能已临时下线：运行时不启动监听、设置保存/加载均强制关闭。
  - 设置页已隐藏该功能的可操作入口，并提示“临时下线”。
- 未完成：
  - 输入面板后续重构任务未启动。
- 下一步：
  - 如需重开功能，先设计不抢焦点的候选交互（例如仅命令面板内选择，不做全局修饰键）。
- 关键文件：
  - src-tauri/src/lib.rs
  - src-tauri/src/settings.rs
  - src/pages/Settings.tsx

### 2026-02-19 23:59
- 本次完成：
  - 紧凑时间线改为单列 Git 风格，取消左右分栏。
- 未完成：
  - 未验证不同窗口尺寸下的密度与可读性。
- 下一步：
  - 实机检查紧凑模式的滚动与选中高亮体验。
- 关键文件：
  - src/pages/Home.tsx

### 2026-02-19 23:59
- 本次完成：
  - 回车/点击复制时在窗口可见状态下显示“已复制”toast。
- 未完成：
  - 未验证隐藏窗口时系统通知仍可用。
- 下一步：
  - 实机确认 Enter 复制时 toast 与通知配置兼容。
- 关键文件：
  - src/pages/Home.tsx

### 2026-02-19 23:59
- 本次完成：
  - 设置页新增手动清理入口（按时间段/日期/天数）。
  - 后端新增清理命令，支持时间段、指定日期前、早于天数的清理。
- 未完成：
  - 未验证清理后列表刷新与提示文案。
- 下一步：
  - 实机验证三种清理方式与返回数量。
- 关键文件：
  - src/pages/Settings.tsx
  - src-tauri/src/lib.rs
  - src-tauri/src/db.rs

### 2026-02-19 23:59
- 本次完成：
  - 紧凑时间线改为 Git graph 风格（节点 + 竖线，按条目渲染）。
- 未完成：
  - 未验证在高密度列表下的视觉一致性。
- 下一步：
  - 实机检查对齐、选中高亮与滚动表现。
- 关键文件：
  - src/pages/Home.tsx

### 2026-02-19 23:59
- 本次完成：
  - 全局滚动条样式改为随主题色变化（含亚克力）。
- 未完成：
  - 未验证不同主题下的对比度与可见性。
- 下一步：
  - 切换主题检查滚动条表现。
- 关键文件：
  - src/main.tsx

### 2026-02-19 23:59
- 本次完成：
  - 修复输入面板窗口 capability 权限（`default.json` 增加 `input-panel`）。
  - 修复输入面板事件订阅稳定性与错误可见性（空白时给出失败提示）。
- 未完成：
  - 需用户实测验证目标应用（浏览器、IDE、聊天软件）内粘贴链路是否全部可用。
- 下一步：
  - 若个别应用仍无法粘贴，优先检查是否需管理员权限运行。
- 关键文件：
  - src-tauri/capabilities/default.json
  - src/pages/InputPanelWindow.tsx

### 2026-02-19 23:59
- 本次完成：
  - 修复“新复制内容不显示”根因（监听迁移到后端常驻）。
  - 修复“通知过多”策略（仅窗口隐藏时通知；并在快捷切换后提示切换内容）。
  - 修复“输入增强小窗口无内容/无法粘贴”（去掉错误自动隐藏 + 后端全局快捷选择）。
- 未完成：
  - 无功能阻塞；仅存在项目既有 unused 警告。
- 下一步：
  - 进行端到端手工验证并根据反馈微调通知文案。
- 关键文件：
  - src-tauri/src/lib.rs
  - src-tauri/src/input_panel.rs
  - src/pages/Home.tsx
  - src/pages/InputPanelWindow.tsx
  - src/hooks/useNotification.ts

### 2026-02-20 06:00
- 本次完成：
  - ✅ 多语言键添加
    - settings.shortcuts.pageTitle
    - settings.shortcuts.resetToDefault
    - settings.shortcuts.saveChanges
    - settings.shortcuts.saved
    - settings.shortcuts.globalShortcuts/globalShortcutsDesc
    - settings.shortcuts.navigation/navigationDesc
    - settings.shortcuts.actions/actionsDesc
    - settings.shortcuts.system/systemDesc
    - settings.shortcuts.numberKeysNote
    - settings.shortcuts.conflicts
    - 各个快捷键的 label 和 desc
    - common.note
  - ✅ Shortcuts.tsx 更新
    - 所有硬编码文本改为 t() 调用
    - 使用翻译键获取标签和描述
  
- 关键文件：
  - src/i18n/locales/en.json - 英文翻译
  - src/i18n/locales/zh.json - 中文翻译
  - src/pages/Shortcuts.tsx - 使用多语言

- 安装包位置：
  - MSI: `src-tauri/target/release/bundle/msi/Fat Clip_0.1.0_x64_en-US.msi`
  - NSIS: `src-tauri/target/release/bundle/nsis/Fat Clip_0.1.0_x64-setup.exe`
