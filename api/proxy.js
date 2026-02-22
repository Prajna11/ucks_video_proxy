/** Vercel Edge Functions 入口 */
import { handleRequest } from '../src/core/proxy.js';

export const config = { runtime: 'edge' };

export default function handler(request) {
  return handleRequest(request, null, null);
}
