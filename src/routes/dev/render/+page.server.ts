import { ENABLE_DEV_HARNESS } from '$app/env/private';
import { dev } from '$app/env';
import { error } from '@sveltejs/kit';

export function load() {
	if (!dev && !ENABLE_DEV_HARNESS) error(404, 'Not found');
	return {};
}
