import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Serves from https://<user>.github.io/gpu-tco/ — keep in sync with the repo name
  base: '/gpu-tco/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
