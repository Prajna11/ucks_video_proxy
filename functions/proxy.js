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
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
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
  const ext = urlPath.split('.').pop();
  return ext && ext.length < 5 ? ext : 'file';
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return createResponse(null, 204);
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return createError('Method Not Allowed', 405);
  }

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

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

  const targetUrlObj = new URL(targetUrl);
  const isDouyin = ['snssdk.com', 'aweme', 'byteimg.com'].some(k => targetUrlObj.hostname.includes(k));
  upstreamHeaders.set('Referer', isDouyin ? 'https://www.douyin.com/' : `${targetUrlObj.origin}/`);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'follow'
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
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

    if (!responseHeaders.has('Cache-Control')) {
      responseHeaders.set('Cache-Control', 'public, max-age=3600');
    }

    const ext = getExtension(contentType, targetUrlObj.pathname);
    const filename = `${Date.now()}_download.${ext}`;
    
    responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);

    return createResponse(upstreamResponse.body, upstreamResponse.status, responseHeaders);

  } catch (error) {
    return createError('Gateway Timeout', 502);
  }
}
