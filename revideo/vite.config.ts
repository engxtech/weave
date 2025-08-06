import {defineConfig} from 'vite';
import motionCanvas from '@revideo/vite-plugin';

export default defineConfig({
  plugins: [
    motionCanvas({
      project: './project.ts',
    }),
  ],
  server: {
    port: 9000,
  },
});