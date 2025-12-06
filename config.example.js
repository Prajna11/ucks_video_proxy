/**
 * 配置文件示例
 * 复制此文件并修改 functions/proxy.js 中的配置
 */

// 允许代理的视频源域名列表
// 支持主域名和子域名匹配
export const ALLOWED_VIDEO_DOMAINS = [
  // 示例：常见视频平台
  'v.qq.com',
  'vd2.bdstatic.com',
  'vd3.bdstatic.com',
  'vd4.bdstatic.com',
  'video.pearvideo.com',
  'img.cdn.aliyun.com',
  'vod.300hu.com',
  
  // 添加你需要代理的视频源域名
  'your-video-cdn.com',
];

// 允许引用此代理服务的网站域名列表
export const ALLOWED_REFERRER_DOMAINS = [
  'ucks.cn',
  'www.ucks.cn',
  
  // 开发环境
  'localhost',
  '127.0.0.1',
  
  // 添加其他允许的域名
];

/**
 * 使用说明：
 * 
 * 1. 将需要代理的视频源域名添加到 ALLOWED_VIDEO_DOMAINS
 * 2. 将允许使用代理的网站域名添加到 ALLOWED_REFERRER_DOMAINS
 * 3. 在 functions/proxy.js 中更新这些配置
 * 
 * 域名匹配规则：
 * - 'example.com' 会匹配 'example.com' 和 '*.example.com'
 * - 支持子域名自动匹配
 */
