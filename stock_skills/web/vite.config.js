import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,   // 0.0.0.0 バインド → LAN内スマホからアクセス可
    proxy: {
      // /api → FastAPI バックエンドへ転送（同一マシン上の8000番ポート）
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
