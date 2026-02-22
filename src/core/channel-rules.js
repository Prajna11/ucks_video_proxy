/** 渠道规则引擎 — 按目标 URL 域名匹配渠道并注入自定义 headers */

import { CHANNEL_RULES, DEFAULT_CHANNEL } from '../config/channels.js';

/**
 * 匹配第一条命中的渠道规则
 * @param {string} targetUrl
 * @returns {{ name: string, domains?: string[], headers: Record<string, string> }}
 */
export function matchChannel(targetUrl) {
    try {
        const { hostname } = new URL(targetUrl);
        for (const rule of CHANNEL_RULES) {
            if (rule.domains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
                return rule;
            }
        }
    } catch { /* ignore */ }
    return DEFAULT_CHANNEL;
}

/**
 * 将命中渠道的 headers 注入 upstreamHeaders（原地修改）
 * @param {Headers} upstreamHeaders
 * @param {string} targetUrl
 * @returns {{ name: string }}
 */
export function applyChannelHeaders(upstreamHeaders, targetUrl) {
    const channel = matchChannel(targetUrl);
    for (const [key, value] of Object.entries(channel.headers)) {
        upstreamHeaders.set(key, value);
    }
    return channel;
}
