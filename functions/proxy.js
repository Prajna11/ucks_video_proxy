import { handleRequest } from '../proxy-core.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};

export async function onRequest(context) {
  return handleRequest(context.request, context.env, context);
}

export const GET = (request, env, ctx) => handleRequest(request, env, ctx);
