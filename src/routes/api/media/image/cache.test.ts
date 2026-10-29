import { afterEach, describe, expect, it, vi } from 'vitest';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

const url = new URL('https://remi.test/api/media/image?provider=tmdb&path=/t/p/w500/abc.jpg');

function request(): { url: URL; request: Request; fetch: typeof fetch } {
	return {
		url,
		request: new Request(url),
		fetch: vi.fn(async () => new Response(PNG, { headers: { 'content-type': 'image/png' } }))
	};
}

/** Stands in for the Workers Cache API, which Node does not provide. */
function installEdgeCache() {
	const store = new Map<string, Response>();
	const cache = {
		match: vi.fn(async (key: Request) => store.get(key.url)?.clone()),
		put: vi.fn(async (key: Request, response: Response) => {
			store.set(key.url, response.clone());
		})
	};
	Object.defineProperty(globalThis, 'caches', { value: { default: cache }, configurable: true });
	return cache;
}

async function handler() {
	vi.resetModules();
	return (await import('./+server')).GET;
}

afterEach(() => {
	Reflect.deleteProperty(globalThis, 'caches');
});

describe('image route edge cache', () => {
	it('serves repeat requests from cache instead of the provider', async () => {
		const cache = installEdgeCache();
		const GET = await handler();

		const first = await GET(request() as never);
		const second = await GET(request() as never);

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(await second.arrayBuffer()).toEqual(await first.arrayBuffer());
		expect(cache.put).toHaveBeenCalledTimes(1);
		expect(second.headers.get('cache-control')).toBe('public, max-age=604800');
	});

	it('hits the provider every time when there is no Cache API', async () => {
		const GET = await handler();
		const first = request();
		const second = request();

		await GET(first as never);
		await GET(second as never);

		expect(first.fetch).toHaveBeenCalledTimes(1);
		expect(second.fetch).toHaveBeenCalledTimes(1);
	});
});
