<svelte:head>
	<title>Remi</title>
</svelte:head>

<main class="blank">
	<p>YOU FOUND A BLANK SPACE IN THE INTERNET.</p>
</main>

<style>
	.blank {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 24px;
		text-align: center;
	}
	p {
		max-width: 18ch;
		margin: 0;
		font-family: var(--display);
		font-size: clamp(28px, 5.4vw, 72px);
		font-weight: 800;
		line-height: 0.95;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}
</style>
