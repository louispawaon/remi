<script lang="ts">
	import { onMount } from 'svelte';
	import logo from '#lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CardSummary } from '#lib/library/types';
	import { importProjectFile } from '#lib/library/import';
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

<svelte:head>
	<title>Library — Remi</title>
</svelte:head>

<div class="library-app">
	<header class="bar">
		<a class="brand" href={resolve('/')} aria-label="Remi library">
			<img class="logo" src={logo} alt="" />
			<span class="wordmark">Remi</span>
		</a>
		<div class="actions">
			<label class="ghost file-label">
				{importing ? 'Importing…' : 'Import'}
				<input
					class="visually-hidden"
					data-testid="import-input"
					type="file"
					accept=".remi,application/zip"
					onchange={importProject}
					disabled={importing}
				/>
			</label>
			<button
				class="stamp"
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
		<div class="title-block">
			<h1 class="display">Library</h1>
			{#if summary}<p class="summary">{summary}</p>{/if}
		</div>

		{#if error}
			<div class="error-block" role="alert">
				<p class="error-text">{error}</p>
				<button class="text-action" type="button" onclick={refresh}>Refresh library</button>
			</div>
		{/if}

		{#if loading}
			<div class="wall" aria-hidden="true">
				{#each [1, 2, 3, 4] as cell (cell)}
					<div class="skeleton-card">
						<div class="skeleton-art"></div>
						<span class="skeleton-line"></span>
					</div>
				{/each}
			</div>
		{:else if cards.length === 0}
			<section class="empty">
				<div class="empty-wall" aria-hidden="true">
					{#each Array.from({ length: 25 }, (_, index) => index) as cell (cell)}
						<span class:lit={cell === 12}></span>
					{/each}
				</div>
				<div class="empty-copy">
					<p class="empty-title display">No sheets yet.</p>
					<p class="empty-line">Make a wall of the things you love, then export it as one image.</p>
					<button class="stamp" type="button" onclick={create}>Make the first sheet</button>
					<p class="label">Or import a .remi project</p>
				</div>
			</section>
		{:else}
			<div class="wall">
				{#each cards as card (card.id)}
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
								<h2 class="display">{card.title}</h2>
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
			</div>
		{/if}
	</main>

	<footer class="foot">
		<span class="foot-links">
			<a class="text-action" href={resolve('/credits')}>Credits</a>
			<a class="text-action" href={resolve('/privacy')}>Privacy</a>
			<a class="text-action" href={resolve('/terms')}>Terms</a>
		</span>
	</footer>
</div>

<style>
	.library-app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 18px 32px;
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
		padding: 40px 32px 64px;
	}
	.title-block {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
		margin-bottom: 40px;
	}
	h1 {
		font-size: 56px;
		margin: 0;
	}
	.summary {
		margin: 0 0 6px;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-2);
	}
	.wall {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 40px 28px;
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
		height: 360px;
		background: var(--card);
		border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
		box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.55);
		overflow: hidden;
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
		height: 100%;
		color: var(--ink-3);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
	}
	.card-body {
		min-width: 0;
		padding-top: 18px;
	}
	h2 {
		font-size: 18px;
		margin: 0 0 8px;
		overflow-wrap: anywhere;
		min-height: 2em;
	}
	.meta {
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
	.empty {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
		gap: 48px;
		align-items: center;
		padding: 48px 0 64px;
		max-width: 820px;
		margin: 0 auto;
	}
	.empty-wall {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 5px;
		width: 280px;
	}
	.empty-wall span {
		aspect-ratio: 1;
		background: var(--card);
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
	}
	.empty-wall span.lit {
		background: var(--action);
		border-color: var(--action);
	}
	.empty-copy {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
	}
	.empty-title {
		font-size: 28px;
		margin: 0;
	}
	.empty-line {
		margin: 0;
		font-size: 15px;
		line-height: 1.45;
		color: var(--ink-2);
		max-width: 34ch;
	}
	.empty .label {
		margin: 4px 0 0;
	}
	.skeleton-card {
		min-width: 0;
	}
	.skeleton-art {
		aspect-ratio: 4 / 5;
		background: rgba(12, 12, 15, 0.55);
		margin-bottom: 18px;
	}
	.skeleton-line {
		display: block;
		height: 10px;
		width: 60%;
		background: rgba(246, 235, 192, 0.22);
	}
	.error-block {
		display: flex;
		gap: 18px;
		align-items: center;
		background: var(--card);
		border-left: 3px solid var(--danger);
		padding: 12px 16px;
		margin-bottom: 24px;
	}
	.error-block .error-text {
		margin: 0;
	}
	.file-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.foot {
		border-top: 1px solid var(--rule);
		padding: 18px 32px;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.foot-links {
		display: flex;
		gap: 20px;
	}
	@media (max-width: 1200px) {
		.wall {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		h1 {
			font-size: 44px;
		}
	}
	@media (max-width: 900px) {
		.bar {
			padding: 14px 16px;
			gap: 10px;
		}
		.logo {
			width: 26px;
			height: 26px;
		}
		main {
			padding: 28px 16px 48px;
		}
		.title-block {
			margin-bottom: 28px;
		}
		h1 {
			font-size: 38px;
		}
		.wall {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.art-link {
			height: 300px;
		}
		.empty {
			grid-template-columns: 1fr;
			gap: 28px;
			padding: 28px 0 48px;
			margin: 0;
		}
		.empty-wall {
			width: 190px;
		}
		.foot {
			padding: 16px;
		}
	}
	@media (max-width: 600px) {
		.wall {
			grid-template-columns: 1fr;
			gap: 32px;
		}
		.actions {
			gap: 8px;
		}
		.actions .ghost {
			padding: 0 12px;
		}
	}
</style>
