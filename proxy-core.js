const ALLOWED_HOSTS = [
  'snssdk.com',
  'byteimg.com',
  'v.qq.com',
  'aweme.snssdk.com',
  'xhscdn.com',
  'xiaohongshu.com',
  'xhslink.com'
];

const ALLOWED_REFERRERS = [
  'ucks.cn',
  'www.ucks.cn'
];

const PASS_THROUGH_HEADERS = new Set([
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'last-modified',
  'etag',
  'cache-control',
  'expires'
]);

const MIME_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-flv': 'flv',
  'video/x-msvideo': 'avi',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/octet-stream': 'bin'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, If-Range, If-Modified-Since, If-None-Match',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition'
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function getRequestHeader(headers, name) {
  const value = headers.get(name);
  return value === null ? null : value;
}

function buildCacheKeyRequest(requestUrl, targetUrl, disposition) {
  const keyUrl = new URL(requestUrl);
  keyUrl.search = '';
  keyUrl.searchParams.set('url', targetUrl);
  keyUrl.searchParams.set('disposition', disposition);
  return new Request(keyUrl.toString(), { method: 'GET' });
}

function isHostAllowed(urlStr, allowList) {
  try {
    const { hostname } = new URL(urlStr);
    return allowList.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function createResponse(body, status = 200, headers = {}) {
  const finalHeaders = new Headers(headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => finalHeaders.set(k, v));
  return new Response(body, { status, headers: finalHeaders });
}

function createError(message, status = 403) {
  return createResponse(JSON.stringify({ error: message }), status, {
    'Content-Type': 'application/json'
  });
}

function getExtension(contentType, urlPath) {
  if (MIME_TYPES[contentType]) return MIME_TYPES[contentType];
  try {
    const pathname = new URL(urlPath, 'http://dummy.com').pathname;
    const ext = pathname.split('.').pop();
    if (ext && ext.length < 5 && ext.length > 1) return ext;
  } catch {}
  return 'file';
}

function getDefaultTtls(contentType, ext) {
  const type = (contentType || '').toLowerCase();
  const normalizedExt = (ext || '').toLowerCase();

  const isImage = type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'].includes(normalizedExt);
  if (isImage) {
    return { browserTtl: 86400, cdnTtl: 2592000 };
  }

  const isVideo = type.startsWith('video/') || ['mp4', 'webm', 'mov', 'flv', 'avi', 'm3u8', 'ts'].includes(normalizedExt);
  if (isVideo) {
    return { browserTtl: 3600, cdnTtl: 86400 };
  }

  return { browserTtl: 3600, cdnTtl: 86400 };
}

export async function handleRequest(request, env, ctx) {
  if (request.method === 'OPTIONS') {
    return createResponse(null, 204);
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return createError('Method Not Allowed', 405);
  }

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  const disposition = (url.searchParams.get('disposition') || 'attachment').toLowerCase();
  const cacheEnabled = (url.searchParams.get('cache') || '1') !== '0';
  const cacheTtlOverride = url.searchParams.get('ttl');

  if (!targetUrl) {
    return createError('Missing url parameter', 400);
  }

  if (!isHostAllowed(targetUrl, ALLOWED_HOSTS)) {
    return createError('Host restricted', 403);
  }

  const requestReferer = request.headers.get('Referer');
  if (requestReferer && !isHostAllowed(requestReferer, ALLOWED_REFERRERS)) {
    return createError('Referrer restricted', 403);
  }

  const upstreamHeaders = new Headers();
  upstreamHeaders.set('User-Agent', USER_AGENT);
  upstreamHeaders.set('Accept', '*/*');

  const range = request.headers.get('Range');
  if (range) upstreamHeaders.set('Range', range);

  const ifNoneMatch = getRequestHeader(request.headers, 'If-None-Match');
  if (ifNoneMatch) upstreamHeaders.set('If-None-Match', ifNoneMatch);

  const ifModifiedSince = getRequestHeader(request.headers, 'If-Modified-Since');
  if (ifModifiedSince) upstreamHeaders.set('If-Modified-Since', ifModifiedSince);

  const ifRange = getRequestHeader(request.headers, 'If-Range');
  if (ifRange) upstreamHeaders.set('If-Range', ifRange);

  const targetUrlObj = new URL(targetUrl);
  const isDouyin = ['snssdk.com', 'aweme', 'byteimg.com'].some(k => targetUrlObj.hostname.includes(k));
  upstreamHeaders.set('Referer', isDouyin ? 'https://www.douyin.com/' : `${targetUrlObj.origin}/`);

  const finalDisposition = disposition === 'inline' ? 'inline' : 'attachment';
  const isCacheableRequest = cacheEnabled && request.method === 'GET' && !range;
  const hasCloudflareCache = typeof caches !== 'undefined' && caches && caches.default;
  const cacheKey = isCacheableRequest ? buildCacheKeyRequest(url.toString(), targetUrl, finalDisposition) : null;

  if (isCacheableRequest && hasCloudflareCache) {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const cachedHeaders = new Headers(cached.headers);
      cachedHeaders.set('X-Proxy-Cache', 'HIT');
      return createResponse(cached.body, cached.status, cachedHeaders);
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'follow'
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206 && upstreamResponse.status !== 304) {
      return createError(`Upstream error: ${upstreamResponse.status}`, upstreamResponse.status);
    }

    const responseHeaders = new Headers();
    let contentType = 'application/octet-stream';

    for (const [key, value] of upstreamResponse.headers) {
      const lowerKey = key.toLowerCase();
      if (PASS_THROUGH_HEADERS.has(lowerKey)) {
        responseHeaders.set(key, value);
        if (lowerKey === 'content-type') {
          contentType = value.split(';')[0].trim();
        }
      }
    }

    const ext = getExtension(contentType, targetUrl);
    const defaultTtls = getDefaultTtls(contentType, ext);
    const browserTtl = cacheTtlOverride === null ? defaultTtls.browserTtl : Math.max(0, Math.min(86400, Number(cacheTtlOverride) || defaultTtls.browserTtl));
    const cdnTtl = Math.max(defaultTtls.cdnTtl, browserTtl);

    if (!responseHeaders.has('Cache-Control')) {
      responseHeaders.set('Cache-Control', `public, max-age=${browserTtl}, s-maxage=${cdnTtl}, stale-while-revalidate=604800`);
    }
    const timestamp = Date.now();
    const filename = `download_${timestamp}.${ext}`;

    responseHeaders.set('Content-Disposition', `${finalDisposition}; filename="${filename}"`);
    responseHeaders.set('Vary', 'Origin, Range');
    responseHeaders.set('X-Proxy-Cache', 'MISS');
    responseHeaders.set('X-Proxy-Cache-Ttl', `${browserTtl}/${cdnTtl}`);

    const response = createResponse(upstreamResponse.body, upstreamResponse.status, responseHeaders);

    if (isCacheableRequest && hasCloudflareCache && upstreamResponse.ok) {
      const putPromise = caches.default.put(cacheKey, response.clone());
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(putPromise);
      } else {
        await putPromise;
      }
    }

    return response;
  } catch {
    return createError('Gateway Timeout', 502);
  }
}
