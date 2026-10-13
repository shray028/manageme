import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

/** Serve the files in /api during `vite dev`, the same way Vercel does in production. */
function devApi(): Plugin {
  return {
    name: 'manageme-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/leetcode')) return next();
        try {
          const mod = await server.ssrLoadModule('/api/leetcode.ts');
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: { 'content-type': String(req.headers['content-type'] ?? 'application/json') },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });
          const handler = req.method === 'POST' ? mod.POST : mod.GET;
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer') || id.includes('node_modules/codemirror')) return 'editor';
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          return undefined;
        },
      },
    },
  },
});
