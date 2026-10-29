<script lang="ts">
	import { onMount } from 'svelte';
	import logo from '#lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CardSummary } from '#lib/library/types';
	import { importProjectFile } from '#lib/library/import';
	import SampleWall from '#lib/library/SampleWall.svelte';
	import {
		createCard,
		createEmptyCard,
		deleteCard,
		duplicateCard,
		listCards,
		loadCard,
		renameCard,
		updateThumbnail
	} from '#lib/library/store';
	import { createThumbnail } from '#lib/library/thumbnail';

	interface Row extends CardSummary {
		url: string | null;
	}

	let cards = $state<Row[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	let importing = $state(false);
	let creating = $state(false);

	const featured = $derived(cards[0] ?? null);
	const rest = $derived(cards.slice(1));

	let urls: string[] = [];

	onMount(() => {
		void refresh();
		return () => {
			for (const url of urls) URL.revokeObjectURL(url);
		};
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			const summaries = await listCards();
			for (const url of urls) URL.revokeObjectURL(url);
			urls = [];
			cards = summaries.map((summary) => {
				const url = summary.thumbnail ? URL.createObjectURL(summary.thumbnail) : null;
				if (url) urls.push(url);
				return { ...summary, url };
			});
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		} finally {
			loading = false;
		}
	}

	async function create() {
		creating = true;
		error = null;
		try {
			const record = createEmptyCard();
			let thumbnail: Blob | undefined;
			try {
				thumbnail = await createThumbnail(record);
			} catch {
				thumbnail = undefined;
			}
			const saved = await createCard(record, thumbnail ? { thumbnail } : {});
			await goto(resolve('/editor/[id]', { id: saved.document.id }));
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		} finally {
			creating = false;
		}
	}

	async function importProject(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		importing = true;
		error = null;
		try {
			const saved = await importProjectFile(new Uint8Array(await file.arrayBuffer()));
			await goto(resolve('/editor/[id]', { id: saved.document.id }));
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		} finally {
			importing = false;
			input.value = '';
		}
	}

	async function duplicate(id: string) {
		error = null;
		try {
			const copy = await duplicateCard(id);
			try {
				const record = await loadCard(copy.document.id);
				if (record) await updateThumbnail(copy.document.id, await createThumbnail(record));
			} catch {
				// The copied card is already saved; its thumbnail can refresh later.
			}
			await refresh();
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		}
	}

	async function remove(id: string) {
		if (deletingId !== id) {
			deletingId = id;
			return;
		}
		error = null;
		try {
			await deleteCard(id);
			deletingId = null;
			await refresh();
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		}
	}

	function startRename(card: Row) {
		renamingId = card.id;
		renameValue = card.title;
	}

	async function commitRename() {
		if (!renamingId) return;
		const title = renameValue.trim();
		if (!title) return;
		try {
			await renameCard(renamingId, title);
			renamingId = null;
			await refresh();
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		}
	}

	function meta(card: Row) {
		const date = new Date(card.updatedAt);
		const waiting = card.unplacedCount > 0 ? ` · ${card.unplacedCount} waiting` : '';
		return `${card.gridSize}×${card.gridSize} · ${card.format} · ${card.itemCount} items${waiting} · ${date.toLocaleDateString(
			undefined,
			{
				month: 'short',
				day: 'numeric'
			}
		)}`;
	}

	const summary = $derived.by(() => {
		if (cards.length === 0) return '';
		const today = new Date().toDateString();
		const editedToday = cards.filter(
			(card) => new Date(card.updatedAt).toDateString() === today
		).length;
		const sheets = `${cards.length} ${cards.length === 1 ? 'sheet' : 'sheets'}`;
		return editedToday > 0
			? `${sheets} · ${editedToday} edited today`
			: `${sheets} · last edited ${new Date(cards[0].updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
	});
</script>

<div class="library-app">
	<header class="bar">
		<a class="brand" href={resolve('/')} aria-label="Remi home">
			<img class="logo" src={logo} alt="" />
			<span class="wordmark">Remi</span>
		</a>
		<div class="actions">
			<button
				class="stamp header-stamp"
				data-testid="new-card"
				type="button"
				disabled={creating}
				onclick={create}
			>
				{creating ? 'Making…' : 'New sheet'}
			</button>
		</div>
	</header>

	<main>
		<section class="hero" aria-labelledby="hero-title">
			<div class="hero-copy">
				<h1 id="hero-title" class="display">
					<span>Everything you love.</span>
					<span>One sheet.</span>
				</h1>
				<p class="lead">
					Search anime, manga, movies, TV and music. Hang the covers on a card, then export the wall
					as one image.
				</p>
				<div class="hero-actions">
					<button class="stamp hero-stamp" type="button" disabled={creating} onclick={create}>
						{creating ? 'Making…' : cards.length === 0 ? 'Make the first sheet' : 'New sheet'}
					</button>
					<label class="ghost file-label">
						{importing ? 'Importing…' : 'Import project'}
						<input
							class="visually-hidden"
							data-testid="import-input"
							type="file"
							accept=".remi,application/zip"
							onchange={importProject}
							disabled={importing}
						/>
					</label>
				</div>
				<ul class="proof" aria-label="Media categories">
					{#each ['Anime', 'Manga', 'Movies', 'TV', 'Music'] as category (category)}
						<li>{category}</li>
					{/each}
				</ul>
			</div>

			<div class="hero-visual">
				{#if loading}
					<div class="poster-frame" aria-hidden="true">
						<div class="poster skeleton-poster">
							<span class="skeleton-label">Opening the wall…</span>
						</div>
					</div>
				{:else if featured}
					<article class="featured" data-testid="card">
						<div class="poster-frame">
							<span class="poster-tag">Latest</span>
							<a
								class="poster-link"
								href={resolve('/editor/[id]', { id: featured.id })}
								aria-label={`Open ${featured.title}`}
							>
								<span class="poster">
									{#if featured.url}
										<img class="poster-art" src={featured.url} alt="" />
									{:else}
										<span class="poster-blank">Empty sheet</span>
									{/if}
								</span>
							</a>
						</div>

						<div class="wall-label">
							{#if renamingId === featured.id}
								<form
									class="rename"
									onsubmit={(event) => {
										event.preventDefault();
										void commitRename();
									}}
								>
									<label class="visually-hidden" for="featured-rename">Card title</label>
									<input
										id="featured-rename"
										class="input"
										type="text"
										bind:value={renameValue}
										onkeydown={(event) => {
											if (event.key === 'Escape') renamingId = null;
										}}
									/>
									<div class="rename-actions">
										<button class="stamp small" type="submit">Save</button>
										<button class="text-action" type="button" onclick={() => (renamingId = null)}
											>Cancel</button
										>
									</div>
								</form>
							{:else}
								<h2 class="display wall-title">{featured.title}</h2>
								<p class="meta">{meta(featured)}</p>
							{/if}

							<div class="label-actions">
								<a class="text-action" href={resolve('/editor/[id]', { id: featured.id })}>Open</a>
								<button class="text-action" type="button" onclick={() => startRename(featured)}
									>Rename</button
								>
								<button class="text-action" type="button" onclick={() => duplicate(featured.id)}
									>Duplicate</button
								>
								<button
									class="text-action delete"
									class:confirming={deletingId === featured.id}
									type="button"
									onclick={() => remove(featured.id)}
									onblur={() => {
										if (deletingId === featured.id) deletingId = null;
									}}
								>
									{deletingId === featured.id ? 'Confirm delete' : 'Delete'}
								</button>
							</div>
						</div>
					</article>
				{:else}
					<article class="featured sample">
						<div class="poster-frame">
							<span class="poster-tag">Sample</span>
							<div class="poster sample-poster">
								<SampleWall />
							</div>
						</div>
						<div class="wall-label">
							<h2 class="display wall-title">Your first wall</h2>
							<p class="meta">3×3 · Free space · No account</p>
						</div>
					</article>
				{/if}
			</div>
		</section>

		{#if error}
			<div class="error-block" role="alert">
				<p class="error-text">{error}</p>
				<button class="text-action" type="button" onclick={refresh}>Refresh library</button>
			</div>
		{/if}

		{#if !loading && cards.length > 1}
			<section class="wall-section" aria-labelledby="wall-title">
				<div class="wall-head">
					<h2 id="wall-title" class="display">Your wall</h2>
					{#if summary}<p class="summary">{summary}</p>{/if}
				</div>
				<div class="wall">
					{#each rest as card (card.id)}
						<article class="sheet-card" data-testid="card">
							<a
								class="art-link"
								href={resolve('/editor/[id]', { id: card.id })}
								aria-label={`Open ${card.title}`}
							>
								{#if card.url}
									<img class="art" src={card.url} alt="" loading="lazy" />
								{:else}
									<span class="art blank">NO IMAGE</span>
								{/if}
							</a>

							<div class="card-body">
								{#if renamingId === card.id}
									<form
										class="rename"
										onsubmit={(event) => {
											event.preventDefault();
											void commitRename();
										}}
									>
										<label class="visually-hidden" for={`rename-${card.id}`}>Card title</label>
										<input
											id={`rename-${card.id}`}
											class="input"
											type="text"
											bind:value={renameValue}
											onkeydown={(event) => {
												if (event.key === 'Escape') renamingId = null;
											}}
										/>
										<div class="rename-actions">
											<button class="stamp small" type="submit">Save</button>
											<button class="text-action" type="button" onclick={() => (renamingId = null)}
												>Cancel</button
											>
										</div>
									</form>
								{:else}
									<h3 class="display">{card.title}</h3>
									<p class="meta">{meta(card)}</p>
								{/if}

								<div class="card-actions">
									<a class="text-action" href={resolve('/editor/[id]', { id: card.id })}>Open</a>
									<button class="text-action" type="button" onclick={() => startRename(card)}
										>Rename</button
									>
									<button class="text-action" type="button" onclick={() => duplicate(card.id)}
										>Duplicate</button
									>
									<button
										class="text-action delete"
										class:confirming={deletingId === card.id}
										type="button"
										onclick={() => remove(card.id)}
										onblur={() => {
											if (deletingId === card.id) deletingId = null;
										}}
									>
										{deletingId === card.id ? 'Confirm delete' : 'Delete'}
									</button>
								</div>
							</div>
						</article>
					{/each}

					<button
						class="new-tile"
						type="button"
						disabled={creating}
						aria-label="Create a new sheet"
						onclick={create}
					>
						<span class="new-mark" aria-hidden="true"></span>
						<span class="new-label">{creating ? 'Making…' : 'New sheet'}</span>
					</button>
				</div>
			</section>
		{/if}
	</main>

	<footer class="foot">
		<p class="foot-note label">Local-first. Nothing leaves this device.</p>
		<nav class="foot-links" aria-label="Footer">
			<a class="text-action" href={resolve('/credits')}>Credits</a>
			<a class="text-action" href={resolve('/privacy')}>Privacy</a>
			<a class="text-action" href={resolve('/terms')}>Terms</a>
		</nav>
	</footer>
</div>

<style>
	.library-app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.bar {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 18px 32px;
		background: var(--ground);
		border-bottom: 1px solid var(--rule);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		flex: none;
	}
	.logo {
		display: block;
		width: 30px;
		height: 30px;
		border-radius: 8px;
	}
	.wordmark {
		font-family: var(--display);
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.04em;
		text-transform: uppercase;
		text-decoration: none;
		line-height: 1;
	}
	.actions {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-left: auto;
		flex-wrap: wrap;
	}
	main {
		flex: 1;
		width: 100%;
		max-width: 1440px;
		margin: 0 auto;
		padding: 0 32px 64px;
	}

	/* The hero: copy on the left, the latest sheet mounted as a poster on the right. */
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr);
		gap: clamp(32px, 6vw, 88px);
		align-items: center;
		padding: clamp(28px, 4vw, 40px) 0 clamp(24px, 3vw, 32px);
	}
	.hero-copy {
		max-width: 620px;
	}
	h1 {
		margin: 0;
		font-size: clamp(40px, 6.2vw, 78px);
	}
	h1 span {
		display: block;
		text-wrap: balance;
	}
	.lead {
		margin: 22px 0 0;
		max-width: 56ch;
		font-size: 16px;
		line-height: 1.5;
		color: var(--ink-2);
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-top: 28px;
	}
	.hero-stamp {
		min-height: 48px;
		padding: 0 24px;
		font-size: 13px;
	}
	.file-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		min-height: 44px;
	}
	.file-label:focus-within {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
	.proof {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 22px;
		margin: 30px 0 0;
		padding: 0;
		list-style: none;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-2);
	}
	.proof li {
		position: relative;
	}
	.proof li + li::before {
		content: '·';
		position: absolute;
		left: -13px;
	}

	.hero-visual {
		display: flex;
		justify-content: center;
		padding: 12px 8px 0;
	}
	.featured {
		width: min(100%, 460px);
	}
	.poster-frame {
		--tilt: -1.4deg;
		position: relative;
		transform: rotate(var(--tilt));
	}
	@media (prefers-reduced-motion: no-preference) {
		.poster-frame {
			animation: hang 0.62s cubic-bezier(0.2, 0.8, 0.2, 1) both;
		}
	}
	@keyframes hang {
		from {
			transform: translateY(-14px) rotate(-3.2deg);
		}
		to {
			transform: rotate(var(--tilt));
		}
	}
	.poster-tag {
		position: absolute;
		top: -12px;
		left: 14px;
		z-index: 2;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--action);
		color: var(--on-action);
		box-shadow: 2px 2px 0 var(--card);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		transform: rotate(-2deg);
	}
	.poster-link {
		display: block;
		text-decoration: none;
	}
	.poster {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
		background: var(--card);
		border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
		box-shadow: 8px 8px 0 var(--card);
		overflow: hidden;
		transition:
			transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.poster-link:hover .poster {
		transform: translate(-2px, -2px);
		box-shadow: 11px 11px 0 var(--card);
	}
	.poster-art {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.poster-blank {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: var(--ink-3);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.sample-poster {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 5.5%;
	}
	.skeleton-poster {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.skeleton-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.wall-label {
		margin-top: 24px;
	}
	.wall-title {
		margin: 0 0 10px;
		font-size: clamp(22px, 2.4vw, 30px);
		overflow-wrap: anywhere;
	}
	.label-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 18px;
		align-items: center;
		margin-top: 14px;
	}
	.label-actions .text-action {
		padding: 0;
		line-height: 1;
	}

	/* The rest of the wall, below the hero. */
	.wall-section {
		border-top: 1px solid var(--rule);
		padding-top: 28px;
	}
	.wall-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px;
		flex-wrap: wrap;
		margin-bottom: 28px;
	}
	.wall-head h2 {
		margin: 0;
		font-size: clamp(28px, 3vw, 40px);
	}
	.summary {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-2);
	}
	.wall {
		--mount-h: clamp(280px, 25vw, 360px);
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 48px 28px;
		align-items: start;
	}
	.sheet-card {
		min-width: 0;
	}
	.art-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: var(--mount-h);
		background: var(--card);
		border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
		box-shadow: 8px 8px 0 color-mix(in srgb, var(--card) 82%, transparent);
		overflow: hidden;
		text-decoration: none;
		transition:
			transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.art-link:hover {
		transform: translate(-2px, -2px);
		box-shadow: 11px 11px 0 color-mix(in srgb, var(--card) 82%, transparent);
	}
	.art {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.art.blank {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-3);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
	}
	.card-body {
		min-width: 0;
		padding-top: 20px;
	}
	.card-body h3 {
		margin: 0 0 8px;
		font-size: 18px;
		overflow-wrap: anywhere;
		min-height: 2em;
	}
	.card-body .meta {
		margin: 0;
	}
	.card-actions {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		align-items: center;
		margin-top: 14px;
	}
	.card-actions .text-action {
		padding: 0;
		line-height: 1;
	}

	.new-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 22px;
		width: 100%;
		height: var(--mount-h);
		background: var(--card);
		border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
		box-shadow: 8px 8px 0 color-mix(in srgb, var(--card) 82%, transparent);
		transition:
			transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.new-tile:hover:not(:disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 11px 11px 0 color-mix(in srgb, var(--card) 82%, transparent);
	}
	.new-mark {
		position: relative;
		display: block;
		width: 48px;
		height: 48px;
	}
	.new-mark::before,
	.new-mark::after {
		content: '';
		position: absolute;
		background: var(--ink);
	}
	.new-mark::before {
		top: 0;
		left: 50%;
		width: 3px;
		height: 100%;
		transform: translateX(-50%);
	}
	.new-mark::after {
		top: 50%;
		left: 0;
		width: 100%;
		height: 3px;
		transform: translateY(-50%);
	}
	.new-label {
		padding: 9px 16px;
		border-radius: 999px;
		background: var(--action);
		color: var(--on-action);
		box-shadow: 2px 2px 0 var(--card);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.delete.confirming {
		color: var(--danger);
		text-decoration-color: var(--danger);
	}
	.rename {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rename-actions {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.stamp.small {
		min-height: 36px;
		padding: 0 16px;
		font-size: 11px;
	}

	.error-block {
		display: flex;
		gap: 18px;
		align-items: center;
		flex-wrap: wrap;
		background: var(--card);
		border: 1.5px solid var(--danger);
		padding: 14px 18px;
		margin-bottom: 32px;
	}
	.error-block .error-text {
		margin: 0;
	}

	.foot {
		border-top: 1px solid var(--rule);
		padding: 18px 32px;
		padding-bottom: max(18px, env(safe-area-inset-bottom));
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.foot-note {
		margin: 0;
	}
	.foot-links {
		display: flex;
		gap: 20px;
	}

	@media (prefers-reduced-motion: reduce) {
		.poster,
		.art-link,
		.new-tile {
			transition: none;
		}
	}

	@media (max-width: 1200px) {
		.wall {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 900px) {
		.bar {
			padding: 14px 16px;
		}
		.logo {
			width: 26px;
			height: 26px;
		}
		main {
			padding: 0 16px 48px;
		}
		.hero {
			grid-template-columns: minmax(0, 1fr);
			gap: 28px;
			padding: 22px 0 40px;
		}
		.hero-copy {
			max-width: 100%;
		}
		h1 {
			font-size: clamp(40px, 9vw, 56px);
		}
		.lead {
			margin-top: 18px;
		}
		.proof {
			margin-top: 20px;
		}
		.hero-visual {
			padding-top: 10px;
		}
		.featured {
			width: min(100%, 430px);
		}
		.poster-frame {
			--tilt: -0.8deg;
		}
		.wall {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 36px 20px;
			--mount-h: clamp(260px, 42vw, 340px);
		}
		.label-actions,
		.card-actions {
			gap: 0 18px;
		}
		.label-actions .text-action,
		.card-actions .text-action {
			min-height: 44px;
		}
		.foot {
			padding: 16px;
			padding-bottom: max(16px, env(safe-area-inset-bottom));
		}
	}
	@media (max-width: 600px) {
		h1 {
			font-size: clamp(32px, 10.4vw, 50px);
		}
		.hero-stamp {
			flex: 1 1 auto;
		}
		.proof {
			display: none;
		}
		.hero-actions .ghost {
			flex: 1 1 auto;
			justify-content: center;
		}
		.wall {
			grid-template-columns: minmax(0, 1fr);
			gap: 36px;
			--mount-h: 300px;
		}
		.wall-head {
			align-items: flex-start;
			flex-direction: column;
			gap: 8px;
		}
		.poster-tag {
			top: -10px;
			left: 10px;
		}
	}
	@media (max-width: 360px) {
		.label-actions,
		.card-actions {
			display: grid;
			grid-template-columns: repeat(2, max-content);
			gap: 0 24px;
		}
	}
</style>
