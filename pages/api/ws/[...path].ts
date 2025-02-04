import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  target: 'http://localhost:8080',
  secure: false,
  timeout: 30000,
  proxyTimeout: 30000
});

// Better error handling
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  // Check if res is a ServerResponse (HTTP) and not a Socket (WebSocket)
  if ('writeHead' in res) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Something went wrong with the proxy.');
  }
});

proxy.on('proxyReqWs', (proxyReq, req, socket) => {
  console.log('WebSocket connecting to:', proxyReq.path);
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req: any, res: any) {
  if (req.url) {
    req.url = req.url.replace('/api', '');
  }

  return new Promise((resolve, reject) => {
    proxy.web(req, res, undefined, (err) => {
      if (err) {
        console.error('Proxy error:', err);
        return reject(err);
      }
      resolve(undefined);
    });
  });
}

export function upgradeHandler(req: any, socket: any, head: Buffer) {
  if (req.url) {
    req.url = req.url.replace('/api', '');
  }
  
  console.log('Upgrading WebSocket connection:', req.url);
  proxy.ws(req, socket, head);
} 