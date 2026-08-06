import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig( {
	root: 'web',
	plugins: [ vue() ],
	publicDir: false,
	build: {
		emptyOutDir: false,
		outDir: 'public/assets',
		rollupOptions: {
			input: 'client/main.ts',
			output: {
				assetFileNames: 'installer-app[extname]',
				entryFileNames: 'installer-app.js'
			}
		}
	}
} );
