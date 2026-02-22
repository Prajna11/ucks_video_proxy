/** Cloudflare Workers / Pages Functions 入口 */
import { handleRequest } from '../src/core/proxy.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};

export async function onRequest(context) {
  return handleRequest(context.request, context.env, context);
}
