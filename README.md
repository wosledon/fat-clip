# Fat Clip

<p align="center">
  <img src="app-icon.png" width="128" height="128" alt="Fat Clip Logo">
</p>

<p align="center">
  <b>A lightweight, efficient, and privacy-focused cross-platform clipboard manager</b>
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> | English
</p>

<p align="center">
  <a href="https://github.com/yourusername/fat-clip/actions/workflows/ci.yml">
    <img src="https://github.com/yourusername/fat-clip/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://github.com/yourusername/fat-clip/releases">
    <img src="https://img.shields.io/github/v/release/yourusername/fat-clip" alt="Latest Release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/yourusername/fat-clip" alt="License">
  </a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#supported-formats">Supported Formats</a> •
  <a href="#keyboard-shortcuts">Keyboard Shortcuts</a> •
  <a href="#screenshots">Screenshots</a>
</p>

---

## Features

- 🚀 **Lightweight & Fast** - Minimal resource usage, instant response
- 🔒 **Privacy First** - All data stored locally, no cloud upload
- 📝 **Multi-Format Support** - Text, Rich Text, Images, and Files
- 🏷️ **Tag System** - Organize clips with custom tags
- 🔍 **Powerful Search** - Full-text search with tag filtering
- 📌 **Pin Important Items** - Keep frequently used clips at the top
- 🎨 **Material Design** - Clean and modern UI
- 🌙 **Dark Mode** - Support for light/dark themes
- ⌨️ **Keyboard Driven** - Navigate entirely with keyboard
- 🌍 **Cross-Platform** - Windows, macOS, and Linux support

## Supported Formats

| Format           | Windows | macOS | Linux |
| ---------------- | ------- | ----- | ----- |
| Plain Text       | ✅       | ✅     | ✅     |
| Rich Text (HTML) | ✅       | ✅     | ❌     |
| Images           | ✅       | ✅     | ❌     |
| Files            | ✅       | ✅     | ✅     |

## Installation

### Windows

Download the latest `.msi` or `.exe` installer from the [Releases](https://github.com/wosledon/fat-clip/releases) page.

```powershell
# Using winget (coming soon)
winget install FatClip
```

### macOS

Download the latest `.dmg` from the [Releases](https://github.com/wosledon/fat-clip/releases) page.

```bash
# Using Homebrew (coming soon)
brew install --cask fat-clip
```

### Linux

Download the latest `.AppImage` or `.deb` from the [Releases](https://github.com/wosledon/fat-clip/releases) page.

```bash
# For Debian/Ubuntu
sudo dpkg -i fat-clip_*.deb

# For AppImage
chmod +x Fat-Clip_*.AppImage
./Fat-Clip_*.AppImage
```

#### Linux Dependencies

```bash
# Ubuntu/Debian
sudo apt-get install xclip wl-clipboard

# Fedora
sudo dnf install xclip wl-clipboard

# Arch
sudo pacman -S xclip wl-clipboard
```

## Usage

### Basic Usage

1. **Copy anything** - Text, images, or files in any application
2. **Press `Ctrl+Shift+V`** (customizable) to open Fat Clip
3. **Search or browse** your clipboard history
4. **Press Enter** to copy the selected item back to clipboard
5. **Paste** in your target application

### Managing Clips

- **Pin/Unpin**: Click the pin icon or press `P` to keep important clips at the top
- **Add Tags**: Click the tag icon or press `T` to organize clips
- **Delete**: Click the delete icon or press `Delete` to remove clips
- **Preview**: Click the expand icon or press `Space` to view full content

### Search Syntax

- **Plain text**: Type any keyword to search
- **Tag search**: `tag:work` or `#work` to filter by tag
- **Type filter**: `type:image` to filter by content type

## Keyboard Shortcuts

| Shortcut        | Action                              |
| --------------- | ----------------------------------- |
| `Ctrl+Shift+V`  | Toggle Fat Clip window              |
| `↑` / `↓`       | Navigate through clips              |
| `Enter`         | Copy selected clip to clipboard     |
| `Space`         | Toggle preview                      |
| `1-9`           | Quick select and copy (top 9 items) |
| `/` or `Ctrl+F` | Focus search box                    |
| `T`             | Add tags to selected clip           |
| `P`             | Pin/unpin selected clip             |
| `Delete`        | Delete selected clip                |
| `Esc`           | Close window / Clear search         |

## Screenshots

<p align="center">
  <img src="docs/screenshots/main-window.png" width="600" alt="Main Window">
</p>

<p align="center">
  <img src="docs/screenshots/image-preview.png" width="600" alt="Image Preview">
</p>

<p align="center">
  <img src="docs/screenshots/tag-management.png" width="600" alt="Tag Management">
</p>

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/) (latest stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Build Steps

```bash
# Clone the repository
git clone https://github.com/wosledon/fat-clip.git
cd fat-clip

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Data Storage

All data is stored locally on your device:

- **Windows**: `%APPDATA%/fat-clip/`
- **macOS**: `~/Library/Application Support/fat-clip/`
- **Linux**: `~/.local/share/fat-clip/`

### Storage Structure

```
fat-clip/
├── fat_clip.db          # SQLite database
├── images/              # Stored images
└── thumbnails/          # Image thumbnails
```

## Privacy & Security

- ✅ All data stored locally
- ✅ No network requests
- ✅ No cloud synchronization
- ✅ Optional database encryption (planned)

## Roadmap

- [ ] Database encryption
- [ ] Cloud sync (optional, user-controlled)
- [ ] OCR for images
- [ ] Batch operations
- [ ] Custom themes
- [ ] Plugin system
- [ ] Mobile companion app

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Fork and clone
git clone https://github.com/wosledon/fat-clip.git
cd fat-clip

# Install dependencies
npm install

# Start development server
npm run tauri dev
```

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI powered by [React](https://reactjs.org/) and [Material-UI](https://mui.com/)
- Clipboard handling via [arboard](https://github.com/1Password/arboard)
