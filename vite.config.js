import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  server: {
    historyApiFallback: true,
  },
  resolve: {
    alias: {
      jsmediatags: fileURLToPath(new URL('./node_modules/jsmediatags/build2/jsmediatags.js', import.meta.url)),
      'react-native-fs': fileURLToPath(new URL('./src/stubs/react-native-fs.js', import.meta.url)),
    },
  },
})
