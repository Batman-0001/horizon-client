import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react({ include: /\.[jt]sx?$/ })],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  resolve: {
    alias: {
      api: path.resolve(__dirname, 'src/api'),
      assets: path.resolve(__dirname, 'src/assets'),
      components: path.resolve(__dirname, 'src/components'),
      contexts: path.resolve(__dirname, 'src/contexts'),
      layouts: path.resolve(__dirname, 'src/layouts'),
      routes: path.resolve(__dirname, 'src/routes.js'),
      'routes.js': path.resolve(__dirname, 'src/routes.js'),
      theme: path.resolve(__dirname, 'src/theme'),
      variables: path.resolve(__dirname, 'src/variables'),
      views: path.resolve(__dirname, 'src/views'),
    },
  },
});
