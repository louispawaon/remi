<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
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
		renameCard
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

	onDestroy(() => {
		for (const url of urls) URL.revokeObjectURL(url);
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
			await duplicateCard(id);
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
		return `${card.gridSize}×${card.gridSize} · ${card.format} · ${date.toLocaleDateString(
			undefined,
			{
				month: 'short',
				day: 'numeric'
			}
		)}`;
	}
</script>

<svelte:head>
	<title>Library — Remi</title>
</svelte:head>

<div class="library-app">
	<header class="bar">
		<div class="brand">
			<span class="wordmark">REMI</span>
			<span class="doc-code">CATALOG · {String(cards.length).padStart(2, '0')} SHEETS</span>
		</div>
		<div class="doc-title">Library</div>
		<div class="bar-meta">
			<span class="dot"></span>
			<span>{String(cards.length).padStart(2, '0')} cards</span>
		</div>
	</header>

	<main>
		<div class="head">
			<div>
				<div class="label">Library</div>
				<h1>Every card is a sheet.</h1>
			</div>
			<div class="actions">
				<label class="ghost file-label">
					{importing ? 'Importing…' : 'Import project'}
					<input
						class="visually-hidden"
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
					{creating ? 'Making…' : 'New card'}
				</button>
			</div>
		</div>

		{#if error}
			<div class="error-block" role="alert">
				<p class="error-text">{error}</p>
				<button class="text-action" type="button" onclick={refresh}>Try again</button>
			</div>
		{/if}

		{#if loading}
			<div class="grid" aria-hidden="true">
				{#each [1, 2, 3, 4] as cell (cell)}
					<div class="skeleton-card">
						<div class="skeleton-art"></div>
						<span class="skeleton-line"></span>
					</div>
				{/each}
			</div>
		{:else if cards.length === 0}
			<section class="empty">
				<div class="empty-grid" aria-hidden="true">
					{#each Array.from({ length: 9 }, (_, index) => index) as cell (cell)}<span></span>{/each}
				</div>
				<p>No sheets yet.</p>
				<button class="stamp" type="button" onclick={create}>Make the first card</button>
				<p class="label">Or import a .remi project</p>
			</section>
		{:else}
			<div class="grid">
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
								<span class="art blank">NO THUMB</span>
							{/if}
						</a>

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
									<button class="text-action" type="submit">Save</button>
									<button class="text-action" type="button" onclick={() => (renamingId = null)}
										>Cancel</button
									>
								</div>
							</form>
						{:else}
							<h2>{card.title}</h2>
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
					</article>
				{/each}
			</div>
		{/if}
	</main>

	<footer class="foot">
		<span class="label">Stored in this browser · export projects for backup</span>
		<a class="text-action" href={resolve('/credits')}>Credits</a>
	</footer>
</div>

<style>
	.library-app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.bar {
		display: grid;
		grid-template-columns: 300px 1fr auto;
		align-items: center;
		gap: 24px;
		padding: 14px 24px;
		border-bottom: 1px solid var(--ink);
	}
	.brand {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.wordmark {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.24em;
	}
	.doc-code {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.14em;
		color: var(--muted);
	}
	.doc-title {
		font-size: 15px;
		font-weight: 500;
	}
	.bar-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.dot {
		width: 6px;
		height: 6px;
		background: var(--spot);
	}
	main {
		flex: 1;
		width: 100%;
		max-width: 1280px;
		margin: 0 auto;
		padding: 32px 40px 48px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
		border-bottom: 1px solid var(--ink);
		padding-bottom: 18px;
		margin-bottom: 26px;
	}
	h1 {
		font-size: 38px;
		line-height: 1.02;
		letter-spacing: -0.03em;
		font-weight: 500;
		margin: 8px 0 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.file-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 18px;
	}
	.sheet-card {
		border: 1px solid var(--rule);
		padding: 10px;
		display: flex;
		flex-direction: column;
	}
	.art-link {
		display: block;
		border: 1px solid var(--ink);
		background: #0d0c0b;
		height: 300px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 10px;
		overflow: hidden;
	}
	.art {
		display: block;
		height: 100%;
		width: auto;
		max-width: 100%;
		object-fit: contain;
	}
	.art.blank {
		color: var(--muted);
		font-family: var(--mono);
		font-size: 9px;
		width: 100%;
	}
	h2 {
		font-size: 13px;
		margin: 0 0 3px;
		font-weight: 500;
	}
	.meta {
		margin: 0;
	}
	.card-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 8px;
	}
	.delete.confirming {
		color: var(--spot);
	}
	.rename {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rename-actions {
		display: flex;
		gap: 10px;
	}
	.empty {
		padding: 64px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
	}
	.empty p {
		margin: 0;
	}
	.empty-grid {
		display: grid;
		grid-template-columns: repeat(3, 20px);
		gap: 4px;
	}
	.empty-grid span {
		width: 20px;
		height: 20px;
		border: 1px solid var(--rule);
	}
	.empty-grid span:nth-child(5) {
		background: var(--spot);
		border-color: var(--spot);
	}
	.skeleton-card {
		border: 1px solid var(--rule);
		padding: 10px;
	}
	.skeleton-art {
		height: 300px;
		background: var(--panel);
		margin-bottom: 10px;
	}
	.skeleton-line {
		display: block;
		height: 8px;
		width: 60%;
		background: var(--panel);
	}
	.error-block {
		border: 1px solid var(--spot);
		padding: 10px 12px;
		margin-bottom: 16px;
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.error-block .error-text {
		margin: 0;
	}
	.foot {
		border-top: 1px solid var(--rule);
		padding: 12px 24px;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	@media (max-width: 1100px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 900px) {
		.bar {
			grid-template-columns: 1fr auto;
			padding: 12px 16px;
		}
		.doc-title {
			display: none;
		}
		main {
			padding: 22px 16px 32px;
		}
		.head {
			flex-direction: column;
			align-items: stretch;
			gap: 14px;
		}
		h1 {
			font-size: 30px;
		}
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
		.art-link,
		.skeleton-art {
			height: 210px;
		}
	}
	@media (max-width: 520px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.art-link,
		.skeleton-art {
			height: 280px;
		}
	}
</style>
