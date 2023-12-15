import { defineConfig } from 'tsup'

export default defineConfig({
  format: ['cjs'],
  entry: ['src/index.ts', 'src/custom-resource-runtime/index.ts'],
  dts: true,
  clean: true,
})
