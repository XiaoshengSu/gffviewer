import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'GFFViewer',
      fileName: (format) => `gffviewer.${format === 'es' ? 'js' : 'umd.cjs'}`,
    },
    rollupOptions: {
      external: ['d3', 'd3-scale', 'd3-zoom', 'pixi.js', 'zustand', 'jszip', 'papaparse'],
      output: {
        globals: {
          d3: 'd3',
          'd3-scale': 'd3',
          'd3-zoom': 'd3',
          'pixi.js': 'PIXI',
          zustand: 'zustand',
          jszip: 'JSZip',
          papaparse: 'Papa'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});