import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
          glsl({
            include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
            defaultExtension: 'glsl',
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['card-dev.gedoawad.com'],
  },
})
