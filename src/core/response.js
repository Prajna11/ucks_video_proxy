/** 响应构建、CORS 与缓存工具 */

export const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, If-Range, If-Modified-Since, If-None-Match, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-Proxy-Cache, X-Proxy-Channel',
};

/** 透传给客户端的上游响应头白名单 */
export const PASS_THROUGH_HEADERS = new Set([
    'content-type', 'content-length', 'content-range', 'accept-ranges',
    'last-modified', 'etag', 'cache-control', 'expires',
]);

/**
 * 创建带 CORS 头的响应
 * @param {BodyInit|null} body
 * @param {number} status
 * @param {Record<string,string>|Headers} headers
 * @returns {Response}
 */
export function createResponse(body, status = 200, headers = {}) {
    const finalHeaders = new Headers(headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) finalHeaders.set(k, v);
    return new Response(body, { status, headers: finalHeaders });
}

/**
 * 创建 JSON 错误响应
 * @param {string} message
 * @param {number} status
 * @returns {Response}
 */
export function createError(message, status = 403) {
    return createResponse(JSON.stringify({ error: message }), status, { 'Content-Type': 'application/json' });
}

/**
 * 构建 Cloudflare Cache API 缓存键
 * @param {string} requestUrl
 * @param {string} targetUrl
 * @param {string} disposition
 * @returns {Request}
 */
export function buildCacheKeyRequest(requestUrl, targetUrl, disposition) {
    const keyUrl = new URL(requestUrl);
    keyUrl.search = '';
    keyUrl.searchParams.set('url', targetUrl);
    keyUrl.searchParams.set('disposition', disposition);
    return new Request(keyUrl.toString(), { method: 'GET' });
}

/**
 * 从上游响应中提取允许透传的响应头，返回 contentType
 * @param {Response} upstreamResponse
 * @param {Headers} responseHeaders
 * @returns {string}
 */
export function extractPassThroughHeaders(upstreamResponse, responseHeaders) {
    let contentType = 'application/octet-stream';
    for (const [key, value] of upstreamResponse.headers) {
        const lk = key.toLowerCase();
        if (PASS_THROUGH_HEADERS.has(lk)) {
            responseHeaders.set(key, value);
            if (lk === 'content-type') contentType = value.split(';')[0].trim();
        }
    }
    return contentType;
}
