import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  base: './',
  build: {
    // 输出目录
    outDir: 'dist',
    // 空入口点
    emptyOutDir: true,
    // 构建静态资源到assets目录
    assetsDir: 'assets',
    // 入口配置
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        options: path.resolve(__dirname, 'options.html'),
        // content.js是内容脚本，不通过HTML加载
      },
      // 输出配置
      output: {
        // 确保文件名不变
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  // 开发服务器配置
  server: {
    port: 3000,
    open: '/options.html',
    // 支持Chrome扩展加载
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  },
  // 解析配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  }
})