import { defineEnvVars } from '@sveltejs/kit/env';
import { optionalSecret } from './lib/server/env';

export const variables = defineEnvVars({
	TMDB_READ_ACCESS_TOKEN: {
		description: 'TMDB v4 read access token. Server-only; imported from $app/env/private.',
		schema: optionalSecret
	},
	ENABLE_RENDER_HARNESS: {
		description: 'Expose /dev/render in a production build for automated tests. Default off.',
		schema: (value) => value === '1'
	}
});
