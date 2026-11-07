// Static file server for the end-to-end tests. It serves the repository root, the way GitHub Pages does.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT) || 4399;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.swf': 'application/x-shockwave-flash',
};

http
  .createServer((request, response) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }

    let filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) {
      response.writeHead(403).end();
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      response.end(data);
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Serving ${ROOT} on http://127.0.0.1:${PORT}`));
