/**
 * 核心代理请求处理器
 * 支持 GET（URL 参数）和 POST（JSON body）双模式
 *
 * headers 优先级（由低→高）：
 *   浏览器指纹 → 渠道规则 → 客户端条件头 → POST body.headers
 */

import { buildBrowserHeaders } from './browser-headers.js';
import { applyChannelHeaders } from './channel-rules.js';
import { createResponse, createError, buildCacheKeyRequest, extractPassThroughHeaders } from './response.js';
import { getExtension, getResourceType, getDefaultTtls, MIME_TYPES } from '../utils/mime.js';
import { ALLOWED_HOSTS, ALLOWED_REFERRERS, isHostAllowed, isReferrerAllowed } from '../utils/security.js';

/** 解析 GET 请求参数 */
function parseGetParams(url) {
    return {
        targetUrl: url.searchParams.get('url'),
        disposition: (url.searchParams.get('disposition') || 'attachment').toLowerCase(),
        cacheEnabled: (url.searchParams.get('cache') || '1') !== '0',
        cacheTtlOverride: url.searchParams.get('ttl'),
        extraHeaders: {},
    };
}

/** 解析 POST body（application/json） */
async function parsePostBody(request) {
    try {
        const body = await request.json();
        return {
            targetUrl: body.url || null,
            disposition: (body.disposition || 'attachment').toLowerCase(),
            cacheEnabled: body.cache !== false,
            cacheTtlOverride: body.ttl != null ? String(body.ttl) : null,
            extraHeaders: body.headers && typeof body.headers === 'object' ? body.headers : {},
        };
    } catch {
        return { targetUrl: null, disposition: 'attachment', cacheEnabled: true, cacheTtlOverride: null, extraHeaders: {} };
    }
}

/**
 * 主请求处理函数，兼容 Vercel Edge 和 Cloudflare Workers/Pages
 * @param {Request} request
 * @param {any} env
 * @param {any} ctx
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, env, ctx) {
    if (request.method === 'OPTIONS') return createResponse(null, 204);
    if (!['GET', 'POST', 'HEAD'].includes(request.method)) return createError('Method Not Allowed', 405);

    const url = new URL(request.url);
    const params = request.method === 'POST' ? await parsePostBody(request) : parseGetParams(url);
    const { targetUrl, disposition, cacheEnabled, cacheTtlOverride, extraHeaders } = params;

    if (!targetUrl) return createError('Missing url parameter', 400);
    if (!isHostAllowed(targetUrl, ALLOWED_HOSTS)) return createError('Host not allowed', 403);
    if (!isReferrerAllowed(request.headers.get('Referer'), ALLOWED_REFERRERS)) return createError('Referrer not allowed', 403);

    // 推断资源类型，选择对应浏览器指纹头
    const urlExt = getExtension('', targetUrl);
    const estimatedType = getResourceType('', urlExt);
    const upstreamHeaders = new Headers(buildBrowserHeaders(estimatedType));

    // 渠道规则注入（覆盖浏览器基础头）
    const matchedChannel = applyChannelHeaders(upstreamHeaders, targetUrl);

    // 透传客户端条件头（覆盖渠道规则）
    const clientRange = request.headers.get('Range');
    if (clientRange) upstreamHeaders.set('Range', clientRange);
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch) upstreamHeaders.set('If-None-Match', ifNoneMatch);
    const ifModifiedSince = request.headers.get('If-Modified-Since');
    if (ifModifiedSince) upstreamHeaders.set('If-Modified-Since', ifModifiedSince);
    const ifRange = request.headers.get('If-Range');
    if (ifRange) upstreamHeaders.set('If-Range', ifRange);

    // POST body.headers（最高优先级）
    for (const [key, value] of Object.entries(extraHeaders)) upstreamHeaders.set(key, value);

    // 缓存（GET/HEAD 无 Range 时可缓存，POST 不缓存）
    const finalDisposition = disposition === 'inline' ? 'inline' : 'attachment';
    const isCacheable = cacheEnabled && (request.method === 'GET' || request.method === 'HEAD') && !clientRange;
    const hasCloudflareCache = typeof caches !== 'undefined' && caches?.default;
    const cacheKey = isCacheable ? buildCacheKeyRequest(url.toString(), targetUrl, finalDisposition) : null;

    if (isCacheable && hasCloudflareCache) {
        const cached = await caches.default.match(cacheKey);
        if (cached) {
            const h = new Headers(cached.headers);
            h.set('X-Proxy-Cache', 'HIT');
            return createResponse(cached.body, cached.status, h);
        }
    }

    try {
        const upstream = await fetch(targetUrl, {
            method: request.method === 'POST' ? 'GET' : request.method,
            headers: upstreamHeaders,
            redirect: 'follow',
        });

        if (!upstream.ok && upstream.status !== 206 && upstream.status !== 304) {
            return createError(`Upstream error: ${upstream.status}`, upstream.status);
        }

        // 206->200: when client did not send Range but channel rule injected one,
        // upstream returns 206. We normalize to 200 so browser downloads work.
        const clientSentRange = !!clientRange;
        const needsNormalize = upstream.status === 206 && !clientSentRange;

        const responseHeaders = new Headers();
        const rawContentType = extractPassThroughHeaders(upstream, responseHeaders);

        // 206->200: remove Content-Range and Content-Length (partial sizes are wrong for full file)
        if (needsNormalize) {
            responseHeaders.delete('Content-Range');
            responseHeaders.delete('Content-Length');
        }

        // 当上游返回通用兜底类型时，从 URL 路径重新推断真实后缀与 MIME
        const urlExt2 = getExtension('', targetUrl);  // 纯路径推断，忽略 content-type
        const ext = rawContentType === 'application/octet-stream' ? urlExt2 : getExtension(rawContentType, targetUrl);

        // 若 content-type 是 octet-stream 但能从 URL 推断出具体类型，则覆盖给客户端
        let contentType = rawContentType;
        if (rawContentType === 'application/octet-stream') {
            const mimeByExt = Object.entries(MIME_TYPES).find(([, v]) => v === ext);
            if (mimeByExt) {
                contentType = mimeByExt[0];
                responseHeaders.set('Content-Type', contentType);
            }
        }

        const { browserTtl: defBrowser, cdnTtl: defCdn } = getDefaultTtls(contentType, ext);
        const browserTtl = cacheTtlOverride === null
            ? defBrowser
            : Math.max(0, Math.min(86400, Number(cacheTtlOverride) || defBrowser));
        const cdnTtl = Math.max(defCdn, browserTtl);

        if (!responseHeaders.has('Cache-Control')) {
            responseHeaders.set('Cache-Control', `public, max-age=${browserTtl}, s-maxage=${cdnTtl}, stale-while-revalidate=604800`);
        }

        responseHeaders.set('Content-Disposition', `${finalDisposition}; filename="download_${Date.now()}.${ext}"`);
        responseHeaders.set('Vary', 'Origin, Range');
        responseHeaders.set('X-Proxy-Cache', 'MISS');
        responseHeaders.set('X-Proxy-Cache-Ttl', `${browserTtl}/${cdnTtl}`);
        responseHeaders.set('X-Proxy-Channel', matchedChannel.name);

        // if client did not send Range but upstream returned 206, respond with 200
        const responseStatus = needsNormalize ? 200 : upstream.status;
        const response = createResponse(upstream.body, responseStatus, responseHeaders);

        if (isCacheable && hasCloudflareCache && upstream.ok) {
            const put = caches.default.put(cacheKey, response.clone());
            if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put);
            else await put;
        }

        return response;
    } catch (err) {
        return createError(`Gateway error: ${err instanceof Error ? err.message : 'Unknown error'}`, 502);
    }
}
