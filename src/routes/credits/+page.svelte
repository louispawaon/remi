<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Credits — Remi</title>
</svelte:head>

<main class="prose-page">
	<a class="back text-action" href={resolve('/')}>← Remi library</a>
	<h1>Credits</h1>

	<section>
		<h2>Metadata and artwork</h2>
		<p>
			Anime and manga metadata and artwork come from
			<a href="https://anilist.co" rel="noreferrer">AniList</a>. AniList’s public API needs no
			account or token.
		</p>
		<p>
			Movie and TV metadata and artwork come from
			<a href="https://www.themoviedb.org" rel="noreferrer">TMDB</a>. This product uses the TMDB API
			but is not endorsed or certified by TMDB.
		</p>
	</section>

	<section>
		<h2>TMDB setup</h2>
		<p>
			Movie and TV discovery needs a TMDB v4 read access token in the server environment as
			<code>TMDB_READ_ACCESS_TOKEN</code>. Without it, those two categories explain the setup step
			and the rest of Remi keeps working. The token never reaches the browser and never appears in
			exports.
		</p>
	</section>

	<section>
		<h2>Your data</h2>
		<p>
			Cards, artwork, and uploads stay in this browser’s IndexedDB. Nothing is uploaded to a Remi
			server. Export a <code>.remi</code> project to keep a durable copy; browser storage can be cleared
			or evicted.
		</p>
	</section>
</main>
