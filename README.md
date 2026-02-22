# Universal Media Proxy

> 真实浏览器模拟代理网关，突破防盗链限制。支持按渠道声明式注入请求头，兼容 Cloudflare Workers / Pages 和 Vercel Edge。

---

## 特性

- **渠道规则引擎** — 按 CDN 域名自动匹配渠道，一处配置注入 Referer / Range / Origin 等任意请求头
- **完整浏览器指纹** — 模拟 Chrome 131 Windows 真实请求（UA / Sec-Fetch-* / Sec-Ch-Ua）
- **GET & POST 双模式** — GET 参数模式 + POST JSON body 模式，POST 支持动态覆盖任意 header
- **多平台无缝切换** — Cloudflare Workers / Pages / Vercel Edge，零修改部署
- **断点续传支持** — Range / Content-Range / Accept-Ranges 全链路透传
- **安全访问控制** — 目标域名白名单 + Referer 来源校验

---

## 快速部署

| 平台 | 方式 |
|---|---|
| **Cloudflare Workers**（推荐） | 直接粘贴 `functions/proxy.js` + `src/` 部署 |
| **Cloudflare Pages** | 连接 Git 仓库，`functions/proxy.js` 自动作为 Function 运行 |
| **Vercel Edge** | 连接 Git 仓库，`api/proxy.js` 自动识别为 API 路由 |

访问地址示例：
```
https://<your-domain>/api/proxy?url=<目标URL>
https://<your-domain>/proxy?url=<目标URL>        ← vercel.json 短路由
https://<your-domain>/?url=<目标URL>             ← vercel.json 根路由
```

---

## 新增渠道（唯一配置入口）

编辑 **`src/config/channels.js`**，在 `CHANNEL_RULES` 数组末尾追加：

```javascript
{
  name: 'your-channel',           // 渠道标识（仅用于调试 X-Proxy-Channel 响应头）
  domains: ['your-cdn.com'],      // CDN 域名，自动匹配所有子域名
  headers: {
    'Referer': 'https://www.your-site.com/',
    'Origin': 'https://www.your-site.com',
    'Range': 'bytes=0-',          // 按需添加
  },
},
```

**无需修改其他任何文件。** 域名 `'your-cdn.com'` 会自动匹配 `your-cdn.com` 及 `*.your-cdn.com` 的所有子域。

### 内置渠道

| 渠道 | 匹配域名 | 特殊 headers |
|---|---|---|
| `xinpianchang` | `xpccdn.com`, `xinpianchang.com` | Referer, Origin, **Range: bytes=0-** |
| `bilibili` | `bilivideo.com`, `bilivideo.cn`, `hdslb.com` | Referer, Origin |
| `douyin` | `snssdk.com`, `byteimg.com`, `douyinvod.com` | Referer, Origin |
| `xiaohongshu` | `xhscdn.com`, `ci.xiaohongshu.com` | Referer, Origin |
| `tencent-video` | `v.qq.com`, `vd*.bdstatic.com` | Referer, Origin |
| `weibo` | `sinaimg.cn`, `mmbiz.qpic.cn` | Referer, Origin |

---

## API 参考

### GET 模式

```
GET /api/proxy?url=<目标URL>[&disposition=inline][&cache=0][&ttl=3600]
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `url` ✅ | — | 完整目标资源 URL |
| `disposition` | `attachment` | `inline`（直接播放/显示）/ `attachment`（下载） |
| `cache` | `1` | `0` 禁用缓存 |
| `ttl` | 自动 | 浏览器缓存秒数（0–86400） |

### POST 模式

```http
POST /api/proxy
Content-Type: application/json

{
  "url": "https://xpccdn.com/video.mp4",
  "disposition": "inline",
  "cache": true,
  "ttl": 3600,
  "headers": {
    "Range": "bytes=1024-2048"
  }
}
```

> `headers` 字段为最高优先级，可覆盖渠道规则和浏览器默认头的任意字段。

### 请求头合并优先级

```
浏览器基础指纹（Chrome 131 UA / Accept / Sec-Fetch-* / Sec-Ch-Ua）
  ↑ 被覆盖
渠道规则 headers（channels.js 匹配注入 Referer / Origin / Range）
  ↑ 被覆盖
客户端透传条件头（Range / If-None-Match / If-Modified-Since / If-Range）
  ↑ 被覆盖（POST 专属）
POST body.headers（最高优先级，可覆盖以上所有）
```

### 响应头

| 响应头 | 含义 |
|---|---|
| `X-Proxy-Cache` | `HIT` / `MISS` |
| `X-Proxy-Channel` | 命中渠道名（如 `xinpianchang`、`bilibili`、`default`） |
| `X-Proxy-Cache-Ttl` | `浏览器TTL/CDN-TTL`（秒） |

---

## 安全配置

编辑 **`src/utils/security.js`**：

```javascript
// 允许代理的目标域名（'*' = 不限制）
export const ALLOWED_HOSTS = ['*'];

// 允许调用本代理的来源 Referer 域名（无 Referer 时默认放行）
export const ALLOWED_REFERRERS = [
  'ucks.cn',
  'www.ucks.cn',
  'localhost',
];
```

---

## 项目结构

```
src/
├── config/channels.js       ← ⭐ 唯一配置入口
├── core/
│   ├── proxy.js             ← 核心处理器（GET + POST）
│   ├── channel-rules.js     ← 域名匹配引擎
│   ├── browser-headers.js   ← 浏览器指纹头生成
│   └── response.js          ← CORS / 缓存 / 响应构建
└── utils/
    ├── mime.js              ← MIME 推断 + TTL 策略
    └── security.js          ← 白名单校验
api/proxy.js                 ← Vercel Edge 入口
functions/proxy.js           ← Cloudflare 入口
```

---

## 缓存策略

| 资源类型 | 浏览器 TTL | CDN TTL |
|---|---|---|
| 图片 | 1 天（86400s） | 30 天（2592000s） |
| 视频 / 音频 | 1 小时（3600s） | 1 天（86400s） |
| 其他 | 1 小时（3600s） | 1 天（86400s） |

> Range 请求（断点续传）不参与缓存，POST 请求不参与缓存。

---

## 免责声明

本项目仅供技术研究使用。请勿用于非法下载受版权保护的内容，使用者需自行承担法律责任，请尊重目标网站的服务条款。

MIT License
