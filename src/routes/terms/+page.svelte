<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Terms — Remi</title>
	<meta
		name="description"
		content="The terms for using Remi, a local-first card maker that stores your work in your browser."
	/>
</svelte:head>

<main>
	<a class="back text-action" href={resolve('/')}>← Remi library</a>
	<h1>Terms</h1>
	<p class="meta">
		Last updated <time datetime="2026-10-29">29 October 2026</time>
	</p>

	<section>
		<h2>Using Remi</h2>
		<p>
			Remi is a free tool for composing media cards from metadata and artwork. Use it for your own
			projects. You do not need an account, and using it does not create a contract beyond these
			terms.
		</p>
	</section>

	<section>
		<h2>Your content</h2>
		<p>
			What you make in Remi is yours. You are responsible for the images you upload and the cards
			you export, including making sure you have the right to use and share them. Do not use Remi to
			infringe someone else’s copyright, trademark, or other rights.
		</p>
		<p>
			Remi stores your work in your browser, not on a server. Keep exports if you need the work to
			last; clearing site data or losing the browser removes it, and that is not recoverable from
			us.
		</p>
	</section>

	<section>
		<h2>Third-party metadata and artwork</h2>
		<p>
			Titles, dates, genres, descriptions and cover images come from
			<a href="https://anilist.co" rel="noreferrer">AniList</a> and
			<a href="https://www.themoviedb.org" rel="noreferrer">TMDB</a>. They are provided by those
			services under their own terms, may be incomplete or wrong, and can change or disappear at any
			time. Remi uses the TMDB API but is not endorsed or certified by TMDB. Rights in that metadata
			and artwork remain with their owners.
		</p>
	</section>

	<section>
		<h2>Reasonable use</h2>
		<p>
			Do not attempt to overload, scrape, or work around the rate limits of the media providers
			through Remi, and do not use the app to break the law. Search access can be suspended to keep
			the service available for everyone.
		</p>
	</section>

	<section>
		<h2>Availability</h2>
		<p>
			Remi is offered as it is, with no promise that it will keep working, keep a feature, or keep a
			provider connection. Movie and TV search depends on a credential that may not be configured,
			and third-party services can go down or change their terms.
		</p>
	</section>

	<section>
		<h2>No warranty and liability</h2>
		<p>
			To the extent permitted by law, Remi is provided without warranties of any kind, and the
			people who run it are not liable for lost cards, lost exports, or any indirect or
			consequential loss from using it. Nothing here limits rights you have that cannot be limited
			by law.
		</p>
	</section>

	<section>
		<h2>Changes</h2>
		<p>
			These terms may change as the app changes. The date above shows the current version, and
			continuing to use Remi after a change means the new terms apply.
		</p>
	</section>

	<section>
		<h2>Contact</h2>
		<p>
			Questions about these terms, or about content you believe should not be here:
			<a href="mailto:miggypawaon@gmail.com">miggypawaon@gmail.com</a>.
		</p>
	</section>

	<footer class="page-foot">
		<a class="text-action" href={resolve('/privacy')}>Privacy</a>
		<a class="text-action" href={resolve('/credits')}>Credits</a>
	</footer>
</main>

<style>
	main {
		max-width: 680px;
		margin: 0 auto;
		padding: 48px 24px 80px;
		font-family: system-ui, sans-serif;
		line-height: 1.6;
		color: #171512;
		background: #f1eee4;
		min-height: 100vh;
	}
	.back {
		display: inline-block;
		margin-bottom: 12px;
	}
	h1 {
		font-size: 40px;
		letter-spacing: -0.03em;
		margin: 0 0 8px;
	}
	.meta {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6e675a;
		margin: 0 0 24px;
	}
	h2 {
		font-size: 12px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		margin: 32px 0 8px;
	}
	p {
		margin: 0 0 10px;
	}
	a {
		color: inherit;
	}
	.page-foot {
		display: flex;
		gap: 20px;
		border-top: 1px solid #c9c2b2;
		margin-top: 40px;
		padding-top: 12px;
	}
</style>
