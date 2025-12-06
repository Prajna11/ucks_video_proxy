# 视频代理服务 - Cloudflare Pages

一个部署在 Cloudflare Pages 上的视频代理服务，用于突破视频防盗链限制，允许在指定网站（如 ucks.cn）上引用第三方视频。

## 功能特性

- ✅ **突破防盗链**：通过修改 Referer 和 User-Agent 绕过视频源的防盗链限制
- ✅ **域名白名单**：支持配置允许代理的视频源域名列表
- ✅ **引用控制**：支持配置允许引用代理服务的网站域名列表
- ✅ **Range 请求支持**：完整支持视频分段加载和拖动播放
- ✅ **CORS 支持**：自动处理跨域请求
- ✅ **CDN 缓存**：利用 Cloudflare CDN 加速视频加载
- ✅ **安全防护**：防止代理服务被滥用

## 部署步骤

### 1. 准备工作

确保你有一个 Cloudflare 账号，并已登录到 [Cloudflare Dashboard](https://dash.cloudflare.com/)。

### 2. 配置域名白名单

编辑 `functions/proxy.js` 文件，修改以下配置：

```javascript
// 允许代理的视频源域名列表
const ALLOWED_VIDEO_DOMAINS = [
  'v.qq.com',              // 腾讯视频
  'vd2.bdstatic.com',      // 百度视频
  'your-video-cdn.com',    // 添加你的视频源域名
];

// 允许引用此代理服务的网站域名列表
const ALLOWED_REFERRER_DOMAINS = [
  'ucks.cn',
  'www.ucks.cn',
  'localhost',             // 本地开发
];
```

### 3. 部署到 Cloudflare Pages

#### 方法一：通过 Git 仓库部署（推荐）

1. 将代码推送到 GitHub/GitLab 仓库
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 进入 **Pages** 页面
4. 点击 **Create a project**
5. 选择 **Connect to Git**
6. 选择你的仓库
7. 配置构建设置：
   - **Framework preset**: None
   - **Build command**: 留空
   - **Build output directory**: `/`
8. 点击 **Save and Deploy**

#### 方法二：通过 Wrangler CLI 部署

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 部署项目
wrangler pages deploy . --project-name=ucks-video-proxy
```

### 4. 配置自定义域名（可选）

1. 在 Cloudflare Pages 项目设置中
2. 进入 **Custom domains**
3. 添加你的自定义域名（如 `proxy.ucks.cn`）

## 使用方法

### 基本用法

代理服务部署后，可以通过以下 URL 格式访问视频：

```
https://your-proxy-domain.pages.dev/proxy?url=https://video-source.com/video.mp4
```

### 在网页中使用

#### HTML5 Video 标签

```html
<video controls>
  <source src="https://your-proxy-domain.pages.dev/proxy?url=https://video-source.com/video.mp4" type="video/mp4">
</video>
```

#### Video.js 播放器

```html
<link href="https://vjs.zencdn.net/8.6.1/video-js.css" rel="stylesheet" />
<script src="https://vjs.zencdn.net/8.6.1/video.min.js"></script>

<video id="my-video" class="video-js" controls preload="auto" width="640" height="360">
  <source src="https://your-proxy-domain.pages.dev/proxy?url=https://video-source.com/video.mp4" type="video/mp4">
</video>

<script>
  var player = videojs('my-video');
</script>
```

#### DPlayer 播放器

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/dplayer/dist/DPlayer.min.css">
<div id="dplayer"></div>
<script src="https://cdn.jsdelivr.net/npm/dplayer/dist/DPlayer.min.js"></script>

<script>
  const dp = new DPlayer({
    container: document.getElementById('dplayer'),
    video: {
      url: 'https://your-proxy-domain.pages.dev/proxy?url=https://video-source.com/video.mp4',
    },
  });
</script>
```

### JavaScript 动态加载

```javascript
const videoUrl = 'https://video-source.com/video.mp4';
const proxyUrl = `https://your-proxy-domain.pages.dev/proxy?url=${encodeURIComponent(videoUrl)}`;

const video = document.querySelector('video');
video.src = proxyUrl;
```

## 安全说明

### Referer 验证

代理服务会验证请求的 Referer 头，只有在 `ALLOWED_REFERRER_DOMAINS` 列表中的域名才能使用代理服务。

**注意**：如果没有 Referer 头，请求会被拒绝。这可以防止直接访问代理 URL。

### 域名白名单

只有在 `ALLOWED_VIDEO_DOMAINS` 列表中的视频源域名才能被代理，防止代理服务被滥用。

### 开发环境

在配置中已包含 `localhost` 和 `127.0.0.1`，方便本地开发测试。生产环境可以移除这些配置。

## 常见问题

### 1. 视频无法播放

- 检查视频源 URL 是否正确
- 确认视频源域名已添加到 `ALLOWED_VIDEO_DOMAINS`
- 确认你的网站域名已添加到 `ALLOWED_REFERRER_DOMAINS`
- 检查浏览器控制台是否有错误信息

### 2. 403 Forbidden 错误

- 检查 Referer 是否在白名单中
- 某些视频源可能有额外的防护措施，需要进一步调整请求头

### 3. 视频加载缓慢

- Cloudflare Pages 的免费版有一定的请求限制
- 可以考虑升级到付费版本以获得更好的性能
- 检查视频源本身的速度

### 4. Range 请求不工作

- 确保视频源支持 Range 请求
- 检查代理服务是否正确转发了 Range 相关的请求头和响应头

## 技术细节

### 支持的请求头

- `Range`: 支持视频分段加载
- `If-Range`: 条件 Range 请求
- `If-Modified-Since`: 缓存验证
- `If-None-Match`: ETag 缓存验证
- `Accept-Encoding`: 内容编码

### 返回的响应头

- `Content-Type`: 内容类型
- `Content-Length`: 内容长度
- `Content-Range`: Range 响应
- `Accept-Ranges`: Range 支持声明
- `Cache-Control`: 缓存控制
- `Access-Control-Allow-Origin`: CORS 支持

### 缓存策略

- 默认缓存时间：1 小时
- 利用 Cloudflare CDN 边缘缓存
- 支持浏览器缓存

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关链接

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/)
