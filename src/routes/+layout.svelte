<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const SITE = 'https://remi.project1of1.com';
	const OG_IMAGE = `${SITE}/opengraph-image.png`;
	const OG_ALT = 'Remi — a tilted black poster with a butter grid on a cobalt field';

	interface Meta {
		title: string;
		description: string;
	}

	const DEFAULT: Meta = {
		title: 'Remi — media card maker for anime, manga, and movies',
		description:
			'Search anime, manga, manhwa, movies, and TV, arrange the covers on one card, and export it as a single image. Local-first, no account required.'
	};

	const PAGES: Record<string, Meta> = {
		'/': DEFAULT,
		'/privacy': {
			title: 'Privacy — Remi',
			description:
				'How Remi handles your data: cards and artwork stay in your browser, search terms go to AniList and TMDB.'
		},
		'/terms': {
			title: 'Terms — Remi',
			description:
				'The terms for using Remi, a local-first card maker that stores your work in your browser.'
		},
		'/credits': {
			title: 'Credits — Remi',
			description:
				'Where Remi’s metadata and artwork come from, how TMDB is used, and where your data lives.'
		}
	};

	const path = $derived(page.url.pathname);
	const meta = $derived(PAGES[path] ?? DEFAULT);
	const canonical = $derived(`${SITE}${path}`);
	const privateRoute = $derived(path.startsWith('/editor/') || path.startsWith('/dev/'));

	const jsonLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Remi',
		url: `${SITE}/`,
		description: DEFAULT.description,
		applicationCategory: 'MultimediaApplication',
		operatingSystem: 'Any',
		browserRequirements: 'Requires JavaScript',
		isAccessibleForFree: true,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		image: OG_IMAGE,
		screenshot: OG_IMAGE
	});
</script>

<svelte:head>
	{#if !privateRoute}
		<title>{meta.title}</title>
	{/if}
	<meta name="description" content={meta.description} />
	<link rel="icon" href={favicon} />
	<link rel="canonical" href={canonical} />
	{#if privateRoute}
		<meta name="robots" content="noindex, nofollow" />
	{:else}
		<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Remi" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:title" content={meta.title} />
	<meta property="og:description" content={meta.description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={OG_IMAGE} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={OG_ALT} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={meta.title} />
	<meta name="twitter:description" content={meta.description} />
	<meta name="twitter:image" content={OG_IMAGE} />
	<meta name="twitter:image:alt" content={OG_ALT} />
	{#if path === '/'}
		{@html `<script type="application/ld+json">${jsonLd}</script>`}
	{/if}
</svelte:head>

{@render children()}
