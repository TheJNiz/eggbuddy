import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Project site served from https://thejniz.github.io/eggbuddy/
  base: '/eggbuddy/',
  plugins: [vue()],
})
