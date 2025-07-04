# FastMFA

FastMFA 是一个快速、安全的 TOTP 双因素认证 Chrome 扩展。

## 特性

- 🚀 快速生成 TOTP 验证码
- 🔒 本地存储，数据安全
- 📱 支持导入 Google Authenticator
- 💾 支持导入/导出备份
- 🎨 简洁美观的界面
- 🔄 支持拖拽排序
- ☁️ 支持云同步 (GitHub Gist)

## 安装

1. 从 Chrome 网上应用店安装（暂不支持）
2. 手动安装
   - 下载代码 https://github.com/SoulChildTc/FastMFA/archive/refs/heads/main.zip
   - 解压后在 Chrome 地址栏打开 `chrome://extensions/`
   - 开启页面右侧的 `开发者模式`
   - 点击页面左侧的 `加载已解压的扩展程序`
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

### 云同步功能
1. 点击云同步按钮进入同步页面
2. 配置同步设置：
   - GitHub Token（需要有 gist 权限）
   - Gist ID（可选，首次同步会自动创建）
   - 加密密钥（强烈建议设置，保护数据安全）
3. 使用同步功能：
   - 上传到云端：将本地数据加密后上传到 GitHub Gist
   - 从云端下载：从 GitHub Gist 下载加密数据并解密到本地

#### 如何创建 GitHub Token

1. 登录到你的 GitHub 账号
2. 点击右上角头像，选择 `Settings`（设置）
3. 在左侧菜单栏中，滚动到底部，点击 `Developer settings`（开发者设置）
4. 在左侧菜单中，选择 `Personal access tokens`（个人访问令牌）
5. 点击 `Tokens (classic)`
6. 点击 `Generate new token`（生成新令牌）→ `Generate new token (classic)`
7. 在 `Note`（备注）字段中，输入一个描述性名称，如 "FastMFA Sync"
8. 选择令牌的有效期（建议选择较长时间或不过期）
9. 在权限列表中，只需勾选 `gist` 权限
10. 滚动到底部，点击 `Generate token`（生成令牌）按钮
11. **重要**：生成的令牌只会显示一次，请立即复制并保存在安全的地方
12. 将此令牌粘贴到 FastMFA 的云同步设置中的 GitHub Token 字段

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

## 安全

- 本地数据可选择加密存储在 GitHub Gist
- 使用 AES 加密算法保护云端数据
- 加密密钥仅存储在本地，不会上传到云端
- 不收集任何用户数据

## 许可证

[MIT](LICENSE)