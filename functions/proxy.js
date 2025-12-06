/**
 * 视频代理服务 - Cloudflare Pages Functions
 * 用于突破视频防盗链限制
 */

// 配置：允许代理的视频源域名列表
const ALLOWED_VIDEO_DOMAINS = [
  'snssdk.com',           // 字节跳动 CDN
  'byteimg.com',          // 字节跳动图片/视频
  'v.qq.com',             // 腾讯视频
  'vd2.bdstatic.com',     // 百度视频
  'video.example.com',
  'cdn.example.com',
  'aweme.snssdk.com',
  // 添加更多允许的视频源域名
];

// 配置：允许引用此代理服务的网站域名列表
const ALLOWED_REFERRER_DOMAINS = [
  'ucks.cn',
  'www.ucks.cn',
  'localhost',
  '127.0.0.1',
  // 添加更多允许引用的域名
];

// 需要转发的请求头
const FORWARD_HEADERS = [
  'range',
  'if-range',
  'if-modified-since',
  'if-none-match',
  'accept-encoding',
];

// 需要返回的响应头
const RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'last-modified',
  'etag',
  'cache-control',
  'expires',
];

/**
 * 检查域名是否在白名单中
 */
function isDomainAllowed(url, allowedDomains) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return allowedDomains.some(domain => {
      const lowerDomain = domain.toLowerCase();
      return hostname === lowerDomain || hostname.endsWith('.' + lowerDomain);
    });
  } catch (e) {
    return false;
  }
}

/**
 * 检查 Referer 是否允许
 */
function isRefererAllowed(referer, allowedDomains) {
  if (!referer) {
    // 如果没有 referer，可以选择允许或拒绝
    // 这里选择拒绝以增强安全性
    return false;
  }
  
  return isDomainAllowed(referer, allowedDomains);
}

/**
 * 创建错误响应
 */
function errorResponse(message, status = 403) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * 主处理函数
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, If-Range, If-Modified-Since, If-None-Match',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  // 只允许 GET 和 HEAD 请求
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return errorResponse('Only GET and HEAD methods are allowed', 405);
  }
  
  // 获取目标视频 URL
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return errorResponse('Missing "url" parameter. Usage: /proxy?url=https://example.com/video.mp4', 400);
  }
  
  // 验证目标 URL 格式
  let targetUrlObj;
  try {
    targetUrlObj = new URL(targetUrl);
    if (!targetUrlObj.protocol.startsWith('http')) {
      return errorResponse('Only HTTP/HTTPS URLs are allowed', 400);
    }
  } catch (e) {
    return errorResponse('Invalid URL format', 400);
  }
  
  // 检查目标域名是否在白名单中
  if (!isDomainAllowed(targetUrl, ALLOWED_VIDEO_DOMAINS)) {
    return errorResponse(`Domain ${targetUrlObj.hostname} is not allowed`, 403);
  }
  
  // 检查 Referer 是否允许
  const referer = request.headers.get('Referer');
  if (!isRefererAllowed(referer, ALLOWED_REFERRER_DOMAINS)) {
    return errorResponse('Referer not allowed or missing', 403);
  }
  
  // 构建代理请求头
  const proxyHeaders = new Headers();
  
  // 转发特定的请求头
  FORWARD_HEADERS.forEach(header => {
    const value = request.headers.get(header);
    if (value) {
      proxyHeaders.set(header, value);
    }
  });
  
  // 设置 User-Agent，模拟浏览器请求
  proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // 伪造 Referer 和 Origin，绕过防盗链
  // 设置为目标域名的根路径，让视频源认为是同域请求
  proxyHeaders.set('Referer', targetUrlObj.origin + '/');
  proxyHeaders.set('Origin', targetUrlObj.origin);
  
  // 添加常见的浏览器请求头，增加真实性
  proxyHeaders.set('Accept', '*/*');
  proxyHeaders.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
  proxyHeaders.set('Sec-Fetch-Dest', 'video');
  proxyHeaders.set('Sec-Fetch-Mode', 'no-cors');
  proxyHeaders.set('Sec-Fetch-Site', 'same-origin');
  
  // 发起代理请求
  try {
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      cf: {
        // Cloudflare 特定选项
        cacheTtl: 3600, // 缓存 1 小时
        cacheEverything: true,
      },
    });
    
    // 构建响应头
    const responseHeaders = new Headers();
    
    // 复制特定的响应头
    RESPONSE_HEADERS.forEach(header => {
      const value = proxyResponse.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });
    
    // 设置 CORS 头，允许跨域访问
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    
    // 添加缓存控制
    if (!responseHeaders.has('Cache-Control')) {
      responseHeaders.set('Cache-Control', 'public, max-age=3600');
    }
    
    // 返回代理响应
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return errorResponse('Failed to fetch video: ' + error.message, 502);
  }
}
