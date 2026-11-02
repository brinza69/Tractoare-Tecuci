// Local preview with Cloudflare Pages' URL rules: /x -> x.html, /x/ -> x/index.html, unknown -> 404.html (status 404).
// Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8788;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const isFile = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.includes('..')) { res.writeHead(400).end(); return; }
  const tries = path.endsWith('/') ? [join(path, 'index.html')] : [path, `${path}.html`, join(path, 'index.html')];
  for (const t of tries) {
    const file = join(ROOT, t);
    if (await isFile(file)) {
      const body = await readFile(file);
      const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
      if (range && /\.(mp4|webm)$/.test(file)) {
        const start = Number(range[1] || 0);
        const end = range[2] ? Number(range[2]) : body.length - 1;
        res.writeHead(206, { 'content-type': TYPES[extname(file)], 'content-range': `bytes ${start}-${end}/${body.length}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
        res.end(body.subarray(start, end + 1));
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'accept-ranges': 'bytes' });
      res.end(body);
      return;
    }
  }
  res.writeHead(404, { 'content-type': TYPES['.html'] });
  res.end(await readFile(join(ROOT, '404.html')));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
