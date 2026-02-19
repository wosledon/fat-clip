# Fat Clip

<p align="center">
  <img src="app-icon.png" width="128" height="128" alt="Fat Clip 图标">
</p>

<p align="center">
  <b>一款轻量、高效、注重隐私的跨平台剪切板管理工具</b>
</p>

<p align="center">
  简体中文 | <a href="README.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/wosledon/fat-clip/actions/workflows/ci.yml">
    <img src="https://github.com/wosledon/fat-clip/actions/workflows/ci.yml/badge.svg" alt="CI 状态">
  </a>
  <a href="https://github.com/wosledon/fat-clip/releases">
    <img src="https://img.shields.io/github/v/release/wosledon/fat-clip" alt="最新版本">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/wosledon/fat-clip" alt="许可证">
  </a>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#安装">安装</a> •
  <a href="#使用指南">使用指南</a> •
  <a href="#支持格式">支持格式</a> •
  <a href="#快捷键">快捷键</a> •
  <a href="#截图">截图</a>
</p>

---

## 功能特性

- 🚀 **轻量快速** - 占用资源少，响应迅速
- 🔒 **隐私优先** - 所有数据本地存储，不上传云端
- 📝 **多格式支持** - 支持文本、富文本、图片和文件
- 🏷️ **标签系统** - 使用自定义标签组织剪切内容
- 🔍 **强大的搜索** - 全文搜索，支持标签过滤
- 📌 **置顶重要项目** - 将常用内容固定在顶部
- 🎨 **Material Design** - 简洁现代的界面设计
- 🌙 **深色模式** - 支持浅色/深色主题
- ⌨️ **键盘驱动** - 完全支持键盘操作
- 🌍 **跨平台** - 支持 Windows、macOS 和 Linux

## 支持格式

| 格式          | Windows | macOS | Linux |
| ------------- | ------- | ----- | ----- |
| 纯文本        | ✅       | ✅     | ✅     |
| 富文本 (HTML) | ✅       | ✅     | ❌     |
| 图片          | ✅       | ✅     | ❌     |
| 文件          | ✅       | ✅     | ✅     |

## 安装

### Windows

从 [Releases](https://github.com/wosledon/fat-clip/releases) 页面下载最新的 `.msi` 或 `.exe` 安装程序。

```powershell
# 使用 winget（即将推出）
winget install FatClip
```

### macOS

从 [Releases](https://github.com/wosledon/fat-clip/releases) 页面下载最新的 `.dmg` 文件。

```bash
# 使用 Homebrew（即将推出）
brew install --cask fat-clip
```

### Linux

从 [Releases](https://github.com/wosledon/fat-clip/releases) 页面下载最新的 `.AppImage` 或 `.deb` 文件。

```bash
# Debian/Ubuntu
sudo dpkg -i fat-clip_*.deb

# AppImage
chmod +x Fat-Clip_*.AppImage
./Fat-Clip_*.AppImage
```

#### Linux 依赖

```bash
# Ubuntu/Debian
sudo apt-get install xclip wl-clipboard

# Fedora
sudo dnf install xclip wl-clipboard

# Arch
sudo pacman -S xclip wl-clipboard
```

## 使用指南

### 基本使用

1. **复制任何内容** - 在任何应用中复制文本、图片或文件
2. **按 `Ctrl+Shift+V`**（可自定义）打开 Fat Clip
3. **搜索或浏览** 您的剪切板历史
4. **按 Enter** 将选中项复制回剪切板
5. **粘贴** 到目标应用中

### 管理剪切项

- **置顶/取消置顶**: 点击置顶图标或按 `P` 键将重要内容固定在顶部
- **添加标签**: 点击标签图标或按 `T` 键为内容添加标签
- **删除**: 点击删除图标或按 `Delete` 键删除内容
- **预览**: 点击展开图标或按 `Space` 键查看完整内容

### 搜索语法

- **普通文本**: 输入任意关键词进行搜索
- **标签搜索**: `tag:工作` 或 `#工作` 按标签过滤
- **类型过滤**: `type:image` 按内容类型过滤

## 快捷键

| 快捷键          | 功能                    |
| --------------- | ----------------------- |
| `Ctrl+Shift+V`  | 显示/隐藏 Fat Clip 窗口 |
| `↑` / `↓`       | 在剪切项间导航          |
| `Enter`         | 将选中项复制到剪切板    |
| `Space`         | 切换预览                |
| `1-9`           | 快速选择并复制（前9项） |
| `/` 或 `Ctrl+F` | 聚焦搜索框              |
| `T`             | 为选中项添加标签        |
| `P`             | 置顶/取消置顶选中项     |
| `Delete`        | 删除选中项              |
| `Esc`           | 关闭窗口 / 清除搜索     |

## 截图

<p align="center">
  <img src="docs/screenshots/main-window.png" width="600" alt="主界面">
</p>

<p align="center">
  <img src="docs/screenshots/image-preview.png" width="600" alt="图片预览">
</p>

<p align="center">
  <img src="docs/screenshots/tag-management.png" width="600" alt="标签管理">
</p>

## 从源码构建

### 前置要求

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/) (最新稳定版)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/wosledon/fat-clip.git
cd fat-clip

# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 生产构建
npm run tauri build
```

## 数据存储

所有数据都存储在您的设备本地：

- **Windows**: `%APPDATA%/fat-clip/`
- **macOS**: `~/Library/Application Support/fat-clip/`
- **Linux**: `~/.local/share/fat-clip/`

### 存储结构

```
fat-clip/
├── fat_clip.db          # SQLite 数据库
├── images/              # 存储的图片
└── thumbnails/          # 图片缩略图
```

## 隐私与安全

- ✅ 所有数据本地存储
- ✅ 无网络请求
- ✅ 无云端同步
- ✅ 可选数据库加密（计划中）

## 路线图

- [ ] 数据库加密
- [ ] 云同步（可选，用户控制）
- [ ] 图片 OCR
- [ ] 批量操作
- [ ] 自定义主题
- [ ] 插件系统
- [ ] 移动端配套应用

## 贡献

欢迎贡献！请阅读我们的 [贡献指南](CONTRIBUTING.md) 了解更多详情。

### 开发环境设置

```bash
# Fork 并克隆
git clone https://github.com/wosledon/fat-clip.git
cd fat-clip

# 安装依赖
npm install

# 启动开发服务器
npm run tauri dev
```

## 许可证

本项目采用 [MIT 许可证](LICENSE) 开源。

## 致谢

- 基于 [Tauri](https://tauri.app/) 构建
- UI 使用 [React](https://reactjs.org/) 和 [Material-UI](https://mui.com/)
- 剪切板处理使用 [arboard](https://github.com/1Password/arboard)
