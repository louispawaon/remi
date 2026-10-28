import { ENABLE_RENDER_HARNESS } from '$app/env/private';
import { dev } from '$app/env';
import { error } from '@sveltejs/kit';

export function load() {
	if (!dev && !ENABLE_RENDER_HARNESS) error(404, 'Not found');
	return {};
}
