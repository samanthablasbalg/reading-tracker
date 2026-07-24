import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: '../backend/openapi.json',
    output: {
      target: './src/app/api/generated/',
      client: 'angular',
      mode: 'tags-split',
    },
  },
});
