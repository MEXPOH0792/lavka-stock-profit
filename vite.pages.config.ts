import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';

export default defineConfig({
 root:'standalone',
 base:'/lavka-stock-profit/',
 publicDir:'../public',
 plugins:[react()],
 resolve:{alias:[
  {find:'next/link',replacement:fileURLToPath(new URL('./standalone/next-link.tsx',import.meta.url))},
  {find:'next/navigation',replacement:fileURLToPath(new URL('./standalone/next-navigation.ts',import.meta.url))},
 ]},
 build:{outDir:'../docs',emptyOutDir:true},
});
