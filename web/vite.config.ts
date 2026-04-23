import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig( {
	plugins: [ vue() ],
	publicDir: false,
	build: {
		emptyOutDir: false,
		outDir: 'public/assets',
		rollupOptions: {
			input: 'client/main.ts',
			output: {
				assetFileNames: 'setup-app[extname]',
				entryFileNames: 'setup-app.js'
			}
		}
	}
} );
