/**
 * 安全与访问控制
 *
 * ALLOWED_HOSTS: 允许代理的目标域名（'*' = 不限制）
 * ALLOWED_REFERRERS: 允许调用本代理的来源域名（无 Referer 时默认放行）
 */

export const ALLOWED_HOSTS = ['*'];

export const ALLOWED_REFERRERS = [
    'ucks.cn',
    'www.ucks.cn',
    'localhost',
    '127.0.0.1',
];

/**
 * 判断 URL 的 hostname 是否在白名单中
 * @param {string} urlStr
 * @param {string[]} allowList
 * @returns {boolean}
 */
export function isHostAllowed(urlStr, allowList) {
    if (allowList.includes('*')) return true;
    try {
        const { hostname } = new URL(urlStr);
        return allowList.some(d => hostname === d || hostname.endsWith(`.${d}`));
    } catch {
        return false;
    }
}

/**
 * 判断 Referer 来源是否被允许（无 Referer 时默认放行）
 * @param {string|null} refererHeader
 * @param {string[]} allowList
 * @returns {boolean}
 */
export function isReferrerAllowed(refererHeader, allowList) {
    if (!refererHeader) return true;
    return isHostAllowed(refererHeader, allowList);
}
