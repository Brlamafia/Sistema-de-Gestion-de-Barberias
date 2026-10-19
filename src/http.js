import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PUBLIC_DIR } from './config.js';

const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

export async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error('Cuerpo demasiado grande.'), { status: 413 });
  }
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}

export function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers });
  res.end(JSON.stringify(payload));
}

export function getCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').filter(Boolean).map(pair => {
    const i = pair.indexOf('='); return [pair.slice(0,i).trim(), decodeURIComponent(pair.slice(i+1))];
  }));
}

export async function serveStatic(pathname, res) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safe = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC_DIR, safe);
  if (!full.startsWith(PUBLIC_DIR)) return false;
  try {
    const data = await readFile(full);
    res.writeHead(200, { 'Content-Type': types[path.extname(full)] || 'application/octet-stream', 'Cache-Control': requested.includes('/assets/') ? 'public, max-age=86400' : 'no-cache' });
    res.end(data); return true;
  } catch { return false; }
}

export function route(pattern, pathname) {
  const names = [];
  const regex = new RegExp('^' + pattern.replace(/:([A-Za-z]+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
  const match = pathname.match(regex);
  return match ? Object.fromEntries(names.map((n,i) => [n, decodeURIComponent(match[i+1])])) : null;
}
