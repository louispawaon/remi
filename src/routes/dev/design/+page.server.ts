import { dev } from '$app/env';
import { error } from '@sveltejs/kit';

export function load({ url }: { url: URL }) {
	if (!dev) error(404, 'Not found');
	return { screen: url.searchParams.get('screen') ?? 'editor' };
}
