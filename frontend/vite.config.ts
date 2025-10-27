import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const workspaceRoot = path.resolve(__dirname);
    const projectRootNodeModules = path.resolve(__dirname, '..', '..', 'node_modules');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(workspaceRoot, 'src'),
          react: path.resolve(projectRootNodeModules, 'react'),
          'react-dom': path.resolve(projectRootNodeModules, 'react-dom'),
          three: path.resolve(projectRootNodeModules, 'three'),
        }
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
      },
      ssr: {
        noExternal: ['three', '@react-three/fiber', '@react-three/drei'],
      },
    };
});
