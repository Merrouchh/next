import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { upgradeHandler } from './pages/api/ws/[...path]';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Handle WebSocket upgrade
  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/api/ws')) {
      upgradeHandler(req, socket, head);
    }
  });

  server.listen(3000, () => {
    console.log('> Ready on http://localhost:3000');
  });
}); 