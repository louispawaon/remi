<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy — Remi</title>
	<meta
		name="description"
		content="How Remi handles your data: cards and artwork stay in your browser, search terms go to AniList and TMDB."
	/>
</svelte:head>

<main class="prose-page">
	<a class="back text-action" href={resolve('/')}>← Remi library</a>
	<h1>Privacy</h1>
	<p class="meta">
		Last updated <time datetime="2026-10-29">29 October 2026</time>
	</p>

	<section>
		<h2>The short version</h2>
		<p>
			Remi is local-first. Your cards, titles, crops and artwork stay in this browser. There is no
			account, no analytics, and no Remi database holding your work. Search terms do leave your
			device so the app can find media.
		</p>
	</section>

	<section>
		<h2>What stays on your device</h2>
		<p>
			Cards, item titles, artwork you upload or add, crop positions, appearance settings, thumbnails
			and revision data are stored in this browser’s IndexedDB. Export files you create are ordinary
			local files. None of this is sent to a Remi server and none of it is readable by us.
		</p>
		<p>
			Clearing site data or deleting a card removes that data. Browser storage can also be evicted
			without warning, which is why exported <code>.remi</code> files are the durable backup.
		</p>
	</section>

	<section>
		<h2>What leaves your device</h2>
		<p>
			When you search, Remi sends your search text, the chosen medium, any filters, the page number
			and your title-language preference to this app’s server. That server forwards the request to
			<a href="https://anilist.co" rel="noreferrer">AniList</a> (anime and manga) or
			<a href="https://www.themoviedb.org" rel="noreferrer">TMDB</a> (movies and TV), plus a request for
			the cover image when you add a result. Those providers see the request and the network address it
			came from, as with any web request, and their own privacy policies apply.
		</p>
		<p>
			The TMDB credential used for movie and TV search is held only on the server. It is never sent
			to your browser and never included in exports. Remi does not log searches to an account, build
			a profile, or link a search to you.
		</p>
	</section>

	<section>
		<h2>Cookies, analytics and ads</h2>
		<p>
			Remi sets no cookies and uses no analytics, advertising, tracking pixels or third-party
			scripts. Nothing runs in the page that reports your behaviour elsewhere.
		</p>
	</section>

	<section>
		<h2>Your choices</h2>
		<p>
			Because your work lives in your browser, you control it directly: delete cards in the library,
			clear site data to remove everything, and export a project to keep a copy. If you believe Remi
			holds data about you, or you want a metadata or artwork correction, write to
			<a href="mailto:miggypawaon@gmail.com">miggypawaon@gmail.com</a>.
		</p>
	</section>

	<section>
		<h2>Children</h2>
		<p>
			Remi is not directed at children under 13, and it does not knowingly collect personal
			information from anyone.
		</p>
	</section>

	<section>
		<h2>Changes</h2>
		<p>
			If how Remi handles data changes, this page changes with it and the date above moves. Material
			changes will be noticeable here rather than in a notification, because Remi has no way to
			contact you.
		</p>
	</section>

	<footer class="page-foot">
		<a class="text-action" href={resolve('/terms')}>Terms</a>
		<a class="text-action" href={resolve('/credits')}>Credits</a>
	</footer>
</main>
