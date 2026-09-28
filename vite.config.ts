import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { devApiPlugin } from './server/apiMiddleware';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
  server: {
    port: 3000,
    host: true
  }
});
