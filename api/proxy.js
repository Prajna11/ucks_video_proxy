import { handleRequest } from '../proxy-core.js';

export const config = {
  runtime: 'edge'
};

export default function handler(request) {
  return handleRequest(request);
}
