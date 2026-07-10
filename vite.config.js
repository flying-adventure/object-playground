import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// server.host: true → 같은 와이파이에 있는 폰에서도 접속 가능
// (npm run dev 실행 시 터미널에 뜨는 "Network:" 주소를 폰 브라우저에 입력)
export default defineConfig({
  plugins: [react()],
  server: { host: true },
})
