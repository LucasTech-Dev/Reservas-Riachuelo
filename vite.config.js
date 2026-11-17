import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const path = value => fileURLToPath(new URL(value, import.meta.url));
export default defineConfig({
  root: path('./front/'),
  publicDir: false,
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    fs: {
      strict: true,
      allow: [path('./front/'), path('./backend/'), path('./node_modules/')],
      deny: ['**/.env', '**/.env.*', '**/*.{pem,key,crt}', '**/.git/**', '**/.local/**', '**/seguranca/**', '**/scripts/**', '**/banco/**', '**/.codex/**', '**/.agents/**', '**/.aws/**']
    }
  },
  build: { outDir: path('./dist/'), emptyOutDir: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true }
});
