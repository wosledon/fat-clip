# Fat Clip - Project Context

## 项目概述

**Fat Clip** 是一个轻量级、高效、隐私优先的跨平台剪贴板管理应用。

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 19 + TypeScript |
| **UI 库** | Material-UI (MUI) v7 + Emotion |
| **路由** | React Router v7 |
| **国际化** | i18next + react-i18next |
| **构建工具** | Vite 7 |
| **桌面框架** | Tauri v2 |
| **后端语言** | Rust |
| **数据库** | SQLite (rusqlite) |
| **剪贴板库** | arboard |

### 项目结构

```
fat-clip/
├── src/                    # React 前端源码
│   ├── assets/            # 静态资源
│   ├── components/        # React 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── i18n/              # 国际化配置
│   │   ├── locales/       # 语言包
│   │   └── index.ts
│   ├── pages/             # 页面组件
│   │   ├── Home.tsx       # 主页面
│   │   ├── Settings.tsx   # 设置页
│   │   ├── Tags.tsx       # 标签管理页
│   │   ├── Shortcuts.tsx  # 快捷键设置页
│   │   └── InputPanelWindow.tsx  # 输入面板窗口
│   ├── App.tsx            # 应用根组件
│   ├── main.tsx           # 应用入口
│   └── vite-env.d.ts      # Vite 类型声明
├── src-tauri/              # Tauri 后端源码 (Rust)
│   ├── src/
│   │   ├── lib.rs         # 主要逻辑和 Tauri 命令
│   │   ├── main.rs        # Rust 入口
│   │   ├── clipboard.rs   # 剪贴板管理
│   │   ├── clipboard_monitor.rs  # 剪贴板监听
│   │   ├── db.rs          # SQLite 数据库操作
│   │   ├── settings.rs    # 设置管理
│   │   ├── tray.rs        # 系统托盘
│   │   └── input_panel.rs # 输入面板管理
│   ├── capabilities/      # Tauri 权限配置
│   ├── icons/             # 应用图标
│   ├── installer-templates/ # 安装器模板
│   ├── Cargo.toml         # Rust 依赖配置
│   └── tauri.conf.json    # Tauri 配置
├── public/                 # 公共静态资源
├── docs/                   # 文档
├── package.json           # Node.js 依赖和脚本
├── tsconfig.json          # TypeScript 配置
├── vite.config.ts         # Vite 配置
└── index.html             # HTML 入口
```

## 核心功能

### 前端功能
- **剪贴板历史管理**: 展示、搜索、删除剪贴记录
- **标签系统**: 为剪贴项添加标签，支持标签筛选
- **置顶功能**: 重要剪贴项可置顶显示
- **多格式支持**: 纯文本、富文本 (HTML)、图片、文件
- **键盘导航**: 完整的键盘快捷键支持
- **主题切换**: 支持浅色/深色/亚克力主题
- **国际化**: 多语言支持

### 后端功能 (Rust)
- **剪贴板监听**: 实时监控剪贴板变化
- **数据存储**: SQLite 本地存储
- **全局快捷键**: 系统级快捷键触发
- **系统托盘**: 托盘图标和菜单
- **通知系统**: 系统通知推送
- **开机自启**: 自动启动支持

## 构建和运行

### 环境要求

- **Node.js**: v18 或更高版本
- **Rust**: 最新稳定版
- **Git**

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 生产构建

```bash
npm run tauri build
```

### 其他命令

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建前端 |
| `npm run preview` | 预览生产构建 |
| `npm run tauri` | Tauri CLI 命令 |
| `npm run icon:generate` | 生成应用图标 |

## 开发规范

### 前端 (TypeScript/React)

- 使用函数组件 + Hooks
- 严格 TypeScript 模式 (`strict: true`)
- 遵循 Material-UI 设计规范
- 组件文件使用 `.tsx` 扩展名
- 使用 `react-router-dom` 进行路由管理

### 后端 (Rust)

- 使用 `cargo fmt` 格式化代码
- 使用 `cargo clippy` 检查代码
- 公共 API 添加文档注释
- Tauri 命令使用 `#[tauri::command]` 宏

### 提交规范

遵循 Conventional Commits:

- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档更新
- `style:` - 代码格式调整
- `refactor:` - 代码重构
- `test:` - 测试相关
- `chore:` - 日常维护

## 关键配置

### Tauri 窗口配置 (`src-tauri/tauri.conf.json`)

- **主窗口**: 520x600, 无边框，始终置顶，透明背景
- **输入面板**: 400x280, 隐藏式面板
- **窗口效果**: Mica 效果 (Windows)

### Vite 配置 (`vite.config.ts`)

- **开发端口**: 1420
- **代码分割**: React、MUI、Tauri、i18n 分别打包
- **HMR**: 端口 1421

### 数据库结构

数据存储在本地 SQLite 数据库:
- **Windows**: `%APPDATA%/fat-clip/fat_clip.db`
- **macOS**: `~/Library/Application Support/fat-clip/fat_clip.db`
- **Linux**: `~/.local/share/fat-clip/fat_clip.db`

## 国际化

支持的语言包位于 `src/i18n/locales/` 目录下，通过 `i18next` 进行多语言切换。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+V` | 打开/关闭窗口 |
| `↑/↓` | 导航剪贴项 |
| `Enter` | 复制选中项 |
| `Space` | 预览 |
| `1-9` | 快速选择前 9 项 |
| `/` 或 `Ctrl+F` | 聚焦搜索框 |
| `T` | 添加标签 |
| `P` | 置顶/取消置顶 |
| `Delete` | 删除 |
| `Esc` | 关闭窗口/清空搜索 |

## 注意事项

1. **Rust 依赖**: 构建前确保 Rust 环境已正确安装
2. **Linux 依赖**: 需要安装 `libgtk-3-dev`, `libwebkit2gtk-4.1-dev` 等
3. **窗口效果**: Mica 效果仅在 Windows 11 上可用
4. **剪贴板格式**: 富文本和图片在 Linux 上可能不支持
