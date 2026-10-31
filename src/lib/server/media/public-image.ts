import { lookup as dnsLookup } from 'node:dns/promises';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import { MediaError, RequestError, timeoutError } from './errors';
import { ALLOWED_TYPES, MAX_IMAGE_BYTES, matchesSignature } from './image-utils';

const MAX_REDIRECTS = 2;
const USER_AGENT = 'remi/1.0';

const blocked = new BlockList();
for (const [network, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.88.99.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4],
	['255.255.255.255', 32]
] as const) {
	blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
	['::', 128],
	['::1', 128],
	['64:ff9b::', 96],
	['100::', 64],
	['2001::', 32],
	['2001:10::', 28],
	['2001:20::', 28],
	['2001:db8::', 32],
	['2002::', 16],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8]
] as const) {
	blocked.addSubnet(network, prefix, 'ipv6');
}

const BLOCKED_HOSTS = new Set([
	'localhost',
	'metadata.google.internal',
	'metadata',
	'instance-data'
]);
const BLOCKED_SUFFIXES = [
	'.localhost',
	'.local',
	'.localdomain',
	'.internal',
	'.home.arpa',
	'.lan',
	'.test',
	'.invalid',
	'.example'
];

export interface PublicImageResponse {
	status: number;
	headers: IncomingHttpHeaders;
	body: AsyncIterable<Uint8Array>;
}

export type PublicImageTransport = (url: URL, signal: AbortSignal) => Promise<PublicImageResponse>;

export function validatePublicImageUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new RequestError('Invalid image URL.');
	}
	if (url.protocol !== 'https:') {
		throw new RequestError('Images must use HTTPS.');
	}
	if (url.username || url.password) {
		throw new RequestError('Image URLs cannot carry credentials.');
	}
	if (url.port && url.port !== '443') {
		throw new RequestError('Images must use the standard HTTPS port.');
	}
	if (url.hash) {
		throw new RequestError('Image URLs cannot carry a fragment.');
	}
	if (isBlockedHostname(url.hostname)) {
		throw new RequestError('That image host is not allowed.');
	}
	return url;
}

export function isBlockedAddress(address: string, family: number): boolean {
	// Block IPv4-mapped IPv6 outright; allowing it would bypass the IPv4 checks.
	if (family === 6 && address.toLowerCase().startsWith('::ffff:')) return true;
	try {
		return blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
	} catch {
		return true;
	}
}

export function isBlockedHostname(hostname: string): boolean {
	const host = hostname
		.replace(/^\[|\]$/g, '')
		.replace(/\.$/, '')
		.toLowerCase();
	if (!host) return true;
	if (host === 'localhost' || host.endsWith('.localhost')) return true;
	if (BLOCKED_HOSTS.has(host)) return true;
	if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
	return isIP(host) !== 0;
}

export async function proxyPublicImage(
	target: URL,
	signal: AbortSignal,
	transport: PublicImageTransport = requestOnce
): Promise<Response> {
	try {
		return await fetchImage(target, signal, transport, MAX_REDIRECTS);
	} catch (error) {
		if (error instanceof MediaError || error instanceof RequestError) throw error;
		if (signal.aborted) {
			if (signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError') {
				throw timeoutError('The image host');
			}
			throw new MediaError('provider_unavailable', 'The image request was cancelled.');
		}
		throw new MediaError('provider_unavailable', 'The image host is not answering right now.');
	}
}

async function requestOnce(url: URL, signal: AbortSignal): Promise<PublicImageResponse> {
	const hostname = url.hostname.replace(/\.$/, '');
	const addresses = await resolveAddresses(hostname);
	const lookup: LookupFunction = (_host, options, callback) => {
		if (options.all) {
			callback(null, addresses);
			return;
		}
		const first = addresses[0];
		callback(null, first.address, first.family);
	};

	return new Promise((resolve, reject) => {
		const request = httpsRequest(
			url,
			{
				method: 'GET',
				lookup,
				servername: hostname,
				headers: {
					accept: 'image/png,image/jpeg,image/webp',
					'user-agent': USER_AGENT
				},
				signal,
				agent: false
			},
			(response) => {
				resolve({
					status: response.statusCode ?? 0,
					headers: response.headers,
					body: bodyOf(response)
				});
			}
		);
		request.on('error', reject);
		request.end();
	});
}

async function* bodyOf(response: IncomingMessage): AsyncIterable<Uint8Array> {
	for await (const chunk of response) {
		yield chunk as Uint8Array;
	}
}

async function resolveAddresses(hostname: string): Promise<{ address: string; family: number }[]> {
	let addresses: { address: string; family: number }[];
	try {
		addresses = await dnsLookup(hostname, { all: true, verbatim: true });
	} catch {
		throw new MediaError('provider_unavailable', 'The image host could not be resolved.');
	}
	if (addresses.length === 0) {
		throw new MediaError('provider_unavailable', 'The image host could not be resolved.');
	}
	if (addresses.some((entry) => isBlockedAddress(entry.address, entry.family))) {
		throw new MediaError('image_rejected', 'That image host is not allowed.');
	}
	return addresses;
}

async function fetchImage(
	url: URL,
	signal: AbortSignal,
	transport: PublicImageTransport,
	redirects: number
): Promise<Response> {
	const response = await transport(url, signal);
	const status = response.status;

	if (status >= 300 && status < 400) {
		const location = header(response.headers, 'location');
		await close(response.body);
		if (!location) {
			throw new MediaError('image_rejected', 'The image host redirected without a location.');
		}
		if (redirects <= 0) {
			throw new MediaError('image_rejected', 'The image host redirected too many times.');
		}
		const next = validatePublicImageUrl(new URL(location, url).href);
		return fetchImage(next, signal, transport, redirects - 1);
	}

	if (status === 429) {
		await close(response.body);
		throw new MediaError(
			'provider_rate_limited',
			'The image host is rate limiting requests. Try again shortly.',
			429,
			retryAfter(response.headers)
		);
	}
	if (status < 200 || status >= 300) {
		await close(response.body);
		throw new MediaError('provider_unavailable', 'The image host rejected the request.');
	}

	const contentType = (header(response.headers, 'content-type') ?? '')
		.split(';')[0]
		.trim()
		.toLowerCase();
	const type = ALLOWED_TYPES[contentType];
	if (!type) {
		await close(response.body);
		throw new MediaError('image_rejected', 'The image host returned an unsupported file type.');
	}

	const declared = Number(header(response.headers, 'content-length'));
	if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
		await close(response.body);
		throw new MediaError('image_too_large', 'That image is larger than 10 MiB.', 413);
	}

	const bytes = await readBody(response.body, type);
	return new Response(bytes as unknown as BodyInit, {
		headers: {
			'content-type': type,
			'content-length': String(bytes.byteLength),
			'cache-control': 'public, max-age=3600',
			'x-content-type-options': 'nosniff'
		}
	});
}

async function readBody(body: AsyncIterable<Uint8Array>, type: string): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	let total = 0;
	for await (const chunk of body) {
		total += chunk.byteLength;
		if (total > MAX_IMAGE_BYTES) {
			throw new MediaError('image_too_large', 'That image is larger than 10 MiB.', 413);
		}
		chunks.push(chunk);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	if (!matchesSignature(type, bytes)) {
		throw new MediaError('image_rejected', 'The image host returned bytes that are not an image.');
	}
	return bytes;
}

async function close(body: AsyncIterable<Uint8Array>): Promise<void> {
	const result = (
		body as AsyncIterable<Uint8Array> & { return?: () => Promise<unknown> }
	).return?.();
	if (result) await result.catch(() => undefined);
}

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
	const value = headers[name.toLowerCase()];
	return Array.isArray(value) ? value[0] : value;
}

function retryAfter(headers: IncomingHttpHeaders): number | undefined {
	const seconds = Number(header(headers, 'retry-after'));
	return Number.isFinite(seconds) ? seconds : undefined;
}
