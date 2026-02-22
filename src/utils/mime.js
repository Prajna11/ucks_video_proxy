/**
 * MIME 类型映射与缓存 TTL 策略
 */

export const MIME_TYPES = {
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'video/x-flv': 'flv', 'video/x-msvideo': 'avi', 'video/ogg': 'ogv',
  'application/x-mpegurl': 'm3u8', 'video/mp2t': 'ts',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/x-icon': 'ico',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/aac': 'aac',
  'application/octet-stream': 'bin',
};

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'flv', 'avi', 'm3u8', 'ts', 'ogv']);
const AUDIO_EXTS = new Set(['mp3', 'ogg', 'wav', 'aac']);

/**
 * 从 Content-Type 或 URL 路径推断文件后缀
 * @param {string} contentType
 * @param {string} urlPath
 * @returns {string}
 */
export function getExtension(contentType, urlPath) {
  // application/octet-stream 是通用兜底类型，不能直接映射 bin，
  // 优先从 URL 路径推断真实后缀
  if (contentType && MIME_TYPES[contentType] && contentType !== 'application/octet-stream') {
    return MIME_TYPES[contentType];
  }
  try {
    const pathname = new URL(urlPath, 'http://dummy.com').pathname;
    const ext = pathname.split('.').pop().split('?')[0].toLowerCase();
    if (ext && ext.length >= 2 && ext.length <= 5) return ext;
  } catch { /* ignore */ }
  return contentType === 'application/octet-stream' ? 'bin' : 'bin';
}

/**
 * 判断资源类型
 * @param {string} contentType
 * @param {string} ext
 * @returns {'image'|'video'|'audio'|'other'}
 */
export function getResourceType(contentType, ext) {
  const t = (contentType || '').toLowerCase();
  const e = (ext || '').toLowerCase();
  if (t.startsWith('image/') || IMAGE_EXTS.has(e)) return 'image';
  if (t.startsWith('video/') || VIDEO_EXTS.has(e)) return 'video';
  if (t.startsWith('audio/') || AUDIO_EXTS.has(e)) return 'audio';
  return 'other';
}

/**
 * 返回资源类型对应的默认缓存 TTL
 * @param {string} contentType
 * @param {string} ext
 * @returns {{ browserTtl: number, cdnTtl: number }}
 */
export function getDefaultTtls(contentType, ext) {
  const kind = getResourceType(contentType, ext);
  if (kind === 'image') return { browserTtl: 86400, cdnTtl: 2592000 };
  return { browserTtl: 3600, cdnTtl: 86400 };
}
