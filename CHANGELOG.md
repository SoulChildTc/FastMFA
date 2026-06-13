# Changelog

## [1.3] - 2026-06-13

### Fixed
- 修复重命名 `prompt()` 在 MV3 popup 中无法正常弹出的问题
  - 改用自定义 Modal 内嵌输入框，支持 Enter 确认 / Escape 取消
- 修复删除确认、云端下载确认等 `confirm()` 在 popup 中的兼容性问题
- 替换所有 `alert()` 为 Toast 通知，避免原生对话框在扩展弹出窗中的显示异常

### Changed
- 全局统一：所有原生 `alert()` / `confirm()` / `prompt()` 替换为自定义组件

## [1.2] - 2026-06-13

### Fixed
- 修复导入按钮在 Chrome MV3 中无法弹出文件选择器的问题
  - 改用 `<label for>` 原生绑定替代 `.click()` 触发文件输入
  - 隐藏方式从 `display: none` 改为 `opacity` + `absolute`，兼容性更好

### Changed
- 导入确认弹框改用自定义 Modal 组件，替代原生 `confirm()`
- 导入错误/成功提示改用 Toast 通知，替代原生 `alert()`
- 导入成功后增加 Toast 反馈（之前无任何提示）

## [1.1] - 2026-06-12

### Added
- 搜索功能：输入关键字快速筛选 token
- 云同步功能：通过 GitHub Gist 加密同步数据

### Changed
- 拖拽排序体验优化（平滑动画、触控支持）

## [1.0] - 2026-06-10

### Added
- TOTP 验证码生成与复制
- 手动添加密钥
- URI 导入（支持 Google Authenticator 格式）
- 导入/导出 JSON 备份
- 右键菜单（复制密钥、复制 URI、导出、重命名、删除）
- 拖拽排序
- 暗色主题 UI
