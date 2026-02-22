/** 浏览器指纹头生成器 — 模拟 Chrome 131 Windows 请求特征 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SEC_CH_UA = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';

const BASE_HEADERS = {
    'User-Agent': UA,
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Ch-Ua': SEC_CH_UA,
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
};

/** @returns {Record<string, string>} */
export function buildVideoHeaders() {
    return {
        ...BASE_HEADERS,
        'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
    };
}

/** @returns {Record<string, string>} */
export function buildImageHeaders() {
    return {
        ...BASE_HEADERS,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
    };
}

/** @returns {Record<string, string>} */
export function buildGenericHeaders() {
    return {
        ...BASE_HEADERS,
        'Accept': '*/*',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
    };
}

/**
 * 根据资源类型返回对应浏览器请求头
 * @param {'image'|'video'|'audio'|'other'} resourceType
 * @returns {Record<string, string>}
 */
export function buildBrowserHeaders(resourceType) {
    switch (resourceType) {
        case 'video':
        case 'audio':
            return buildVideoHeaders();
        case 'image':
            return buildImageHeaders();
        default:
            return buildGenericHeaders();
    }
}
