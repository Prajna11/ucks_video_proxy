/**
 * 渠道规则配置（唯一配置入口）
 *
 * 新增渠道：在 CHANNEL_RULES 末尾追加规则对象，无需修改其他文件。
 * 域名匹配：'example.com' 自动匹配 example.com 及所有子域名。
 */

/** @type {Array<{ name: string, domains: string[], headers: Record<string, string> }>} */
export const CHANNEL_RULES = [
    {
        name: 'xinpianchang',
        domains: ['xpccdn.com', 'xinpianchang.com'],
        headers: {
            'Referer': 'https://www.xinpianchang.com/',
            'Origin': 'https://www.xinpianchang.com',
            'Range': 'bytes=0-',
        },
    },

    // ── 添加新渠道模板 ──
    // {
    //   name: 'your-channel',
    //   domains: ['your-cdn.com'],
    //   headers: {
    //     'Referer': 'https://www.your-site.com/',
    //     'Origin': 'https://www.your-site.com',
    //     // 'Range': 'bytes=0-',
    //   },
    // },
];

/** 兜底配置（无渠道命中时使用） */
export const DEFAULT_CHANNEL = {
    name: 'default',
    headers: {},
};
