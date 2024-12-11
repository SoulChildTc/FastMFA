# FastMFA

FastMFA 是一个快速、安全的 TOTP 双因素认证 Chrome 扩展。

## 特性

- 🚀 快速生成 TOTP 验证码
- 🔒 本地存储，数据安全
- 📱 支持导入 Google Authenticator
- 💾 支持导入/导出备份
- 🎨 简洁美观的界面
- 🔄 支持拖拽排序

## 安装

1. 从 Chrome 网上应用店安装（即将上线）
2. 手动安装
   - 下载最新 [Release](https://github.com/soulchildtc/fastmfa/releases)
   - Chrome 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择解压后的文件夹

## 使用说明

### 添加新密钥
1. 点击右上角 "+" 按钮
2. 选择手动添加或 URI 导入
3. 输入必要信息并保存

### 复制验证码
- 点击验证码即可复制
- 进度条显示验证码剩余有效时间

### 管理密钥
- 右键点击可以进行更多操作
- 拖拽可以调整顺序
- 支持导入导出备份

## 开发

### 项目结构
```
fastmfa/
├── manifest.json    # 扩展配置文件
├── popup.html      # 弹出窗口 HTML
├── popup.js        # 主要逻辑代码
├── styles.css      # 样式文件
├── icons/         # 图标文件
└── lib/           # 第三方库
```

### 使用和调试
1. 在 Chrome 中加载开发版本：
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目目录

## 安全

- 所有数据仅存储在本地
- 不收集任何用户数据
- 无网络请求

## 许可证

[MIT](LICENSE)