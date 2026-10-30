import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/dashboard/api': 'http://127.0.0.1:8000',
      '/sensor-data': 'http://127.0.0.1:8000',
      '/ai': 'http://127.0.0.1:8000',
      '/cows': 'http://127.0.0.1:8000',
      '/alerts': 'http://127.0.0.1:8000',
      '/analytics': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/status': 'http://127.0.0.1:8000',
      '/predict': 'http://127.0.0.1:8000',
      '/detect': 'http://127.0.0.1:8000',
    },
  },
});

