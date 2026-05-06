# Obsidian Web Clipper（中文内容增强版）

> 基于官方 [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) Fork，专门为中文内容平台增强。

[English](./README_EN.md)

## 与官方版本有什么不同？

本 Fork 针对中文内容平台增加了以下增强功能：

### Bilibili 视频支持

在 Reader Mode 中增加了 **Bilibili 视频支持**，体验与官方的 YouTube 集成保持一致：

- **内容提取** — 从 Bilibili 视频页面提取视频简介、章节和字幕
- **视频嵌入** — 在 Reader Mode 中嵌入 Bilibili 播放器，支持置顶固定
- **时间戳点击跳转** — 点击任意字幕或章节的时间戳，视频跳转到对应时间
- **自动滚动** — 播放过程中自动滚动字幕，跟随播放进度
- **高亮当前行** — 播放时高亮显示当前字幕行
- **跨浏览器支持** — 支持 Chrome 和 Firefox，自动处理 `Referer` 请求头

### 飞书文档完整提取

官方版本通过通用 DOM 解析提取飞书文档内容，会因飞书的动态渲染机制导致内容不完整。本 Fork 接入 **飞书开放平台 API**，通过结构化接口完整获取文档内容：

- **完整内容** — 获取文档所有块内容，包括文字、标题、列表、代码块、表格、引用等
- **图片获取** — 使用飞书内部 Web API 下载文档图片，无需额外权限，只要用户在浏览器中能打开文档即可正常显示图片
- **Wiki 支持** — 同时支持飞书知识库（`/wiki/`）和普通文档（`/docx/`）链接
- **结构保留** — 保留文档原有层级结构，转换为标准 HTML，可被 Obsidian Clipper 正常处理

**配置方法：**

1. 前往[飞书开放平台](https://open.feishu.cn/app)创建一个自建应用
2. 为应用开通以下权限：`docx:document:readonly`、`wiki:node:read`
3. 获取应用的 App ID 和 App Secret（参见[官方文档：获取访问凭证](https://open.feishu.cn/document/server-docs/api-call-guide/calling-process/get-access-token#63c75bdc)）
4. 打开 Obsidian Web Clipper 扩展 → 点击右上角 **设置** → **General** → 找到 **飞书 / Lark** 区块，填入 App ID 和 App Secret

> **隐私说明**：App ID 和 App Secret 仅保存在你本地浏览器的存储中（`browser.storage.local`），不会上传到任何服务器。

### 为什么没有合并到官方项目？

官方维护者[指出](https://github.com/obsidianmd/obsidian-clipper/pull/1)，针对特定网站的内容提取器应该在 [Defuddle](https://github.com/kepano/defuddle)（内容提取库）中实现，而不是在 Web Clipper 扩展本身。由于将 Bilibili 支持集成到 Defuddle 需要不同的架构方案，本 Fork 独立维护此功能，方便有需要的用户直接使用。

## 快速开始

### 从源码构建

```bash
npm install
npm run build
```

构建产物：
- `dist/` — Chromium 版本
- `dist_firefox/` — Firefox 版本
- `dist_safari/` — Safari 版本

### 本地安装扩展

**Chromium 浏览器**（Chrome、Brave、Edge、Arc）：

1. 打开浏览器访问 `chrome://extensions`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择 `dist` 目录

**Firefox**：

1. 打开 Firefox 访问 `about:debugging#/runtime/this-firefox`
2. 点击 **临时载入附加组件**
3. 进入 `dist_firefox` 目录，选择 `manifest.json` 文件

如需在 Firefox 中永久安装，可使用 Nightly 或 Developer 版本：

1. 地址栏输入 `about:config`
2. 搜索 `xpinstall.signatures.required`
3. 双击将其设为 `false`
4. 前往 `about:addons` > 齿轮图标 > **从文件安装附加组件…**

## 许可证

MIT — 与[原项目](https://github.com/obsidianmd/obsidian-clipper)一致。
