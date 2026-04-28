import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import menuRouter from './routes/menu.js';
import locationRouter from './routes/location.js';

// Export createApp so tests can import the app without starting the HTTP server
export async function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint — used by Docker, Kubernetes, and CI smoke tests
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'coffee-shop',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use('/api/menu', menuRouter);
  app.use('/api/location', locationRouter);

  if (process.env.NODE_ENV === 'production') {
    // Serve the built React app in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else if (process.env.NODE_ENV !== 'test') {
    // Dynamic import — vite is a devDependency, not present in production image.
    // Using import() here means Node only resolves it when this branch actually runs.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Only start the HTTP server when this file is executed directly, not when imported in tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
