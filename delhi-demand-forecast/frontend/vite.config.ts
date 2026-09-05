import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// In development /api is proxied to the FastAPI server so the browser makes
// same-origin calls. In production set VITE_API_BASE to the API base URL.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // OneDrive / Dropbox mark every file as a reparse point on Windows. Vite 8's native
  // resolver treats those as symlinks and fails with "could not be resolved" for every
  // dependency. Not following symlinks avoids that; nothing here relies on symlinked packages.
  resolve: { preserveSymlinks: true },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
