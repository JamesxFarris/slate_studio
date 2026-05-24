import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server config for the Slate Studio frontend.
//
// - Dev port pinned to 5173 to match expectations in the backend CORS allow-list.
// - `/api` and `socket.io` are proxied to the local backend (port 3001) so the
//   frontend code can speak to relative URLs in both dev and prod.
// - `ws: true` on the socket.io proxy is mandatory for the websocket upgrade.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
