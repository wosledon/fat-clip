# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-02-25

### Refactored
- 优化 clipboard_monitor.rs 中的 Clipboard 处理，使用 `.ok().and_then()` 替代 `unwrap()`
- 改进 tray.rs 错误处理，使用 `ok_or()` 和 `if let` 处理 Mutex 和图标加载
- 简化 useWindowToggle Hook，移除不必要的 useState，避免状态同步问题

### Fixed
- 修复 clippy `collapsible_else_if` 警告
- 修复 `toggle_main_window` 函数中缺少 return 关键字的编译错误

## [0.1.1] - 2026-02-25

### Fixed
- 修复窗口显示/隐藏逻辑问题，避免重复打开和打不开的情况
- 改进全局快捷键处理，支持 Ctrl+Shift+V 切换窗口显示/隐藏
- 改进托盘图标双击事件处理，使用一致的 toggle 逻辑
- 修复设置保存时的窗口状态更新竞争条件

### Added
- 新增 `toggle_main_window` 命令统一处理窗口切换
- 新增 `useWindowToggle` React Hook 提供统一的窗口管理 API
- 添加项目上下文文档 QWEN.md

## [Unreleased]

### Added
- Multi-format clipboard support (Text, Rich Text, Images, Files)
- Cross-platform support (Windows, macOS, Linux)
- Tag system for organizing clips
- Full-text search with tag filtering
- Pin/unpin functionality
- Keyboard navigation
- Dark mode support
- Global shortcut (Ctrl+Shift+V)
- System notifications
- Auto-start on login

## [0.1.0] - 2026-02-19

### Added
- Initial release
- Basic clipboard history
- SQLite database storage
- Material Design UI
- Windows, macOS, and Linux builds

[0.1.2]: https://github.com/wosledon/fat-clip/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/wosledon/fat-clip/compare/v0.1.0...v0.1.1
[Unreleased]: https://github.com/wosledon/fat-clip/compare/v0.1.2...HEAD
[0.1.0]: https://github.com/wosledon/fat-clip/releases/tag/v0.1.0
