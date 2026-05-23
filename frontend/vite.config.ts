import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-antd': ['antd', '@ant-design/icons'],
                    'vendor-echarts': ['echarts', 'echarts-for-react'],
                    'vendor-charts': ['lightweight-charts', 'recharts'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
    },
    preview: {
        headers: {
            'Cache-Control': 'public, max-age=31536000',
        },
    },
})
