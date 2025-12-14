
# 📦 Universal Media Download Proxy (通用媒体下载代理)

一个基于 Serverless (Edge) 技术的轻量级媒体代理服务。它能够绕过防盗链限制，解决 CORS 问题，并强制浏览器**下载**资源（而不是播放/预览）。

支持 **Cloudflare Workers**、**Cloudflare Pages** 和 **Vercel Edge Functions** 一键部署。

## ✨ 主要特性

  * **⚡️ 多平台支持**：一套代码同时兼容 Cloudflare Workers/Pages 和 Vercel Edge。
  * **📥 强制下载**：自动设置 `Content-Disposition: attachment`，强制浏览器弹出下载对话框。
  * **🛡 绕过防盗链**：
      * 智能伪造 `Referer` 头。
      * 针对字节跳动系（抖音/TikTok/头条）特殊处理，解决域名不一致导致的 403 问题。
  * **🎨 智能类型识别**：自动根据 `Content-Type` 或 URL 路径识别文件后缀（mp4, jpg, png, webp 等）。
  * **🔒 安全控制**：内置来源域名白名单（Host）和请求来源白名单（Referer），防止滥用。
  * **🚀 高性能**：利用边缘计算节点的缓存策略和流式传输。

## 🛠 部署指南

您可以选择以下任意一种方式进行部署：

### 1\. Cloudflare Workers (推荐)

最简单、性能最好的部署方式。

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -\> **Create Application** -\> **Create Worker**。
3.  命名你的 Worker（例如 `media-proxy`）并点击 **Deploy**。
4.  点击 **Edit code**。
5.  将 `index.js` (或提供的完整代码) 粘贴到编辑器中，覆盖原有内容。
6.  点击 **Save and Deploy**。

### 2\. Cloudflare Pages

如果你希望将其作为现有静态网站的一部分。

1.  在你的项目根目录下创建一个 `functions` 文件夹。
2.  在文件夹内创建一个文件，例如 `proxy.js` 或 `index.js`。
3.  将代码粘贴进去。
4.  部署到 Cloudflare Pages。
5.  访问地址：`https://你的域名/proxy?url=...` (取决于文件名)。

### 3\. Vercel Edge Functions

适用于 Next.js 项目或独立 API。

1.  创建一个文件：
      * **Next.js (App Router):** `app/api/proxy/route.js`
      * **Next.js (Pages Router):** `pages/api/proxy.js`
2.  将代码粘贴进去。
3.  **重要**：确保你的环境支持 Edge Runtime（Next.js App Router 默认支持，Pages Router 需要添加 `export const runtime = 'edge';` 配置，虽然代码中已尽量兼容，但建议检查）。

-----

## ⚙️ 配置说明

为了安全起见，你需要修改代码顶部的常量配置：

### 1\. 允许代理的资源域名 (`ALLOWED_HOSTS`)

只有在此列表中的域名（及其子域名）才会被代理。

```javascript
const ALLOWED_HOSTS = [
  'snssdk.com',      // 字节跳动 CDN
  'byteimg.com',
  'v.qq.com',        // 腾讯视频
  'aweme.snssdk.com',
  'xhscdn.com',      // 小红书
  // ...添加你需要支持的域名
];
```

### 2\. 允许调用的来源 (`ALLOWED_REFERRERS`)

限制谁可以使用这个代理服务（防盗链）。

```javascript
const ALLOWED_REFERRERS = [
  'ucks.cn',
  'www.ucks.cn'
];
```

> **注意**：如果不传 Referer（直接在浏览器地址栏输入代理 URL），代码逻辑允许通过。但如果通过网页 `<a>` 标签或 `fetch` 调用，来源必须在白名单内。

-----

## 🔗 API 使用方法

部署完成后，通过 GET 请求调用服务。

**URL 格式：**

```
https://<你的部署域名>/?url=<目标媒体链接>
```

**示例：**

```bash
# 下载视频
https://worker.your-domain.com/?url=https://aweme.snssdk.com/aweme/v1/play/...

# 下载图片
https://worker.your-domain.com/?url=https://sns-img-hw.xhscdn.com/...
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `url` | String | 是 | 需要下载的完整目标资源 URL (需包含 http/https) |

-----

## 📝 常见问题

**Q: 为什么直接访问返回 "Referrer restricted"?**
A: 请检查 `ALLOWED_REFERRERS` 配置。如果你是从一个未授权的网站发起请求，会被拦截。如果你是直接在浏览器地址栏回车访问，通常可以通过（除非浏览器强制发送了 Referer）。

**Q: 下载的文件名是乱码或没有后缀？**
A: 代理服务会尝试从 URL 和 `Content-Type` 解析文件名。如果无法解析，默认命名为 `download_{时间戳}.file`。

**Q: 支持断点续传吗？**
A: 支持。代码透传了 `Range`、`Content-Range` 和 `Accept-Ranges` 头，支持视频拖拽播放和断点下载。

-----

## ⚖️ 免责声明 (Disclaimer)

本项目仅供技术研究和学习使用。

  * 请勿用于非法下载受版权保护的内容。
  * 使用者需自行承担因使用本项目而产生的任何法律责任。
  * 请尊重目标网站的服务条款（TOS）和防盗链策略。

-----

## 📄 License

MIT License
