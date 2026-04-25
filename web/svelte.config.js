import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		// Content-Security-Policy: prerender 時に inline script の sha256 を自動計算し
		// <meta http-equiv="Content-Security-Policy"> として HTML に埋め込む。
		// _headers 側の CSP と衝突しないよう、CSP は SvelteKit が出力する meta tag に集約する。
		// frame-ancestors は meta では無視されるため X-Frame-Options: DENY (_headers) で防御。
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'connect-src': ['self'],
				'base-uri': ['self'],
				'form-action': ['none']
			}
		}
	}
};

export default config;
