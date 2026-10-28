<script lang="ts">
	import { onMount } from 'svelte';
	import { createProjectArchive } from '#lib/card/archive';
	import { renameDocument } from '#lib/card/document';
	import { createFixtureDocument } from '#lib/card/fixture';
	import type { CardRecord } from '#lib/card/types';
	import { createFixtureArtwork, recordFor } from '#lib/dev/artwork';
	import type { LibraryCardView, LibraryHarnessApi } from '#lib/dev/library-api';
	import { Autosave, type AutosaveStatus } from '#lib/library/autosave';
	import { resetLibrary } from '#lib/library/db';
	import { importProjectFile } from '#lib/library/import';
	import {
		createCard,
		createEmptyCard,
		deleteCard,
		duplicateCard,
		listCards,
		loadCard,
		renameCard,
		saveCard
	} from '#lib/library/store';
	import { createThumbnail } from '#lib/library/thumbnail';

	interface Row extends LibraryCardView {
		url: string | null;
	}

	let rows = $state<Row[]>([]);
	let statusText = $state('Ready');
	let currentId = $state<string | null>(null);
	let titleDraft = $state('');

	let current: CardRecord | null = null;
	let autosave: Autosave | null = null;
	let urls: string[] = [];

	function label(status: AutosaveStatus, detail?: string): string {
		switch (status) {
			case 'dirty':
				return 'Unsaved changes';
			case 'saving':
				return 'Saving…';
			case 'saved':
				return 'Saved';
			case 'conflict':
				return detail ?? 'Changed in another tab. Reload the library.';
			case 'error':
				return `Save failed: ${detail ?? 'unknown error'}`;
		}
	}

	async function refresh() {
		const summaries = await listCards();
		for (const url of urls) URL.revokeObjectURL(url);
		urls = [];

		rows = summaries.map((summary) => {
			const url = summary.thumbnail ? URL.createObjectURL(summary.thumbnail) : null;
			if (url) urls.push(url);
			return {
				id: summary.id,
				title: summary.title,
				revision: summary.revision,
				itemCount: summary.itemCount,
				unplacedCount: summary.unplacedCount,
				updatedAt: summary.updatedAt,
				thumbnailBytes: summary.thumbnail?.size ?? 0,
				url
			};
		});

		if (currentId && !summaries.some((summary) => summary.id === currentId)) {
			currentId = null;
			current = null;
			titleDraft = '';
			autosave?.dispose();
			autosave = null;
		}
	}

	async function attach(record: CardRecord) {
		if (autosave) {
			await autosave.flush();
			autosave.dispose();
		}
		current = record;
		currentId = record.document.id;
		titleDraft = record.document.title;
		autosave = new Autosave(record, saveCard, {
			debounceMs: 250,
			onStatus: (status, detail) => (statusText = label(status, detail)),
			onSaved: (saved) => {
				current = saved;
				void refresh();
			}
		});
	}

	async function createEmpty() {
		const record = createEmptyCard();
		const thumbnail = await createThumbnail(record);
		const saved = await createCard(record, { thumbnail });
		await attach(saved);
		statusText = 'Saved';
		await refresh();
		return saved.document.id;
	}

	async function createFixture() {
		const document = createFixtureDocument();
		const record = recordFor(document, await createFixtureArtwork());
		const thumbnail = await createThumbnail(record);
		const saved = await createCard(record, { thumbnail });
		await attach(saved);
		statusText = 'Saved';
		await refresh();
		return saved.document.id;
	}

	async function openCard(id: string) {
		const record = await loadCard(id);
		if (!record) throw new Error('That card no longer exists.');
		await attach(record);
		statusText = 'Saved';
	}

	function editTitle(title: string) {
		if (!current || !autosave) throw new Error('Open a card first.');
		current = { ...current, document: renameDocument(current.document, title) };
		titleDraft = title;
		autosave.update(current);
	}

	async function updateTitle(title: string) {
		editTitle(title);
		await autosave?.flush();
		await refresh();
	}

	async function removeCard(id: string) {
		if (id === currentId) {
			autosave?.dispose();
			autosave = null;
			current = null;
			currentId = null;
		}
		await deleteCard(id);
		await refresh();
	}

	async function exportBytes(id: string): Promise<number[]> {
		const record = id === current?.document.id ? current : await loadCard(id);
		if (!record) throw new Error('That card no longer exists.');
		return Array.from(await createProjectArchive(record));
	}

	async function downloadCurrent() {
		if (!currentId) return;
		const bytes = new Uint8Array(await exportBytes(currentId));
		const blob = new Blob([bytes], { type: 'application/zip' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'remi-library-export.remi';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	async function importFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const saved = await importProjectFile(new Uint8Array(await file.arrayBuffer()));
			await attach(saved);
			statusText = `Imported “${saved.document.title}”`;
			await refresh();
		} catch (error) {
			statusText = `Import failed: ${message(error)}`;
		} finally {
			input.value = '';
		}
	}

	function message(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}

	function showError(error: unknown) {
		statusText = `Action failed: ${message(error)}`;
	}

	onMount(() => {
		const api: LibraryHarnessApi = {
			reset: resetLibrary,
			createEmpty,
			createFixture,
			list: async () =>
				(await listCards()).map((summary) => ({
					id: summary.id,
					title: summary.title,
					revision: summary.revision,
					itemCount: summary.itemCount,
					unplacedCount: summary.unplacedCount,
					updatedAt: summary.updatedAt,
					thumbnailBytes: summary.thumbnail?.size ?? 0
				})),
			load: async (id) => {
				const record = await loadCard(id);
				return record ? { document: record.document, artwork: Object.keys(record.artwork) } : null;
			},
			open: openCard,
			rename: async (id, title) => {
				await renameCard(id, title);
				if (id === currentId) {
					const updated = await loadCard(id);
					if (updated) await attach(updated);
				}
				await refresh();
			},
			duplicate: async (id) => {
				const copy = await duplicateCard(id);
				await refresh();
				return copy.document.id;
			},
			remove: removeCard,
			updateTitle,
			status: () => statusText,
			exportBytes,
			importBytes: async (bytes) => {
				const saved = await importProjectFile(new Uint8Array(bytes));
				await attach(saved);
				statusText = 'Imported';
				await refresh();
				return saved.document.id;
			}
		};

		window.__remiLibrary = api;
		void refresh();

		return () => {
			delete window.__remiLibrary;
			autosave?.dispose();
			for (const url of urls) URL.revokeObjectURL(url);
		};
	});
</script>

<svelte:head>
	<title>Library harness — Remi</title>
</svelte:head>

<main>
	<h1>Library harness</h1>
	<p>
		Diagnostic surface for local cards, revisions, thumbnails, and project import. Not product UI.
	</p>

	<div class="actions">
		<button data-testid="new-empty" onclick={() => createEmpty().catch(showError)}>New card</button>
		<button data-testid="new-fixture" onclick={() => createFixture().catch(showError)}
			>New fixture card</button
		>
		<button data-testid="flush" onclick={() => autosave?.flush()}>Flush save</button>
		<button data-testid="export-current" onclick={downloadCurrent} disabled={!currentId}>
			Export current
		</button>
		<label>
			Import project
			<input
				data-testid="import-input"
				type="file"
				accept=".remi,application/zip"
				onchange={importFile}
			/>
		</label>
	</div>

	<p data-testid="status">{statusText}</p>

	{#if currentId}
		<div class="title-row">
			<label for="card-title">Current card title</label>
			<input
				id="card-title"
				data-testid="title"
				bind:value={titleDraft}
				oninput={(event) => editTitle(event.currentTarget.value)}
			/>
		</div>
	{/if}

	<ul class="cards">
		{#each rows as row (row.id)}
			<li data-testid="card-row">
				{#if row.url}
					<img src={row.url} alt="" width="72" />
				{:else}
					<span class="no-thumb">no thumb</span>
				{/if}
				<div class="meta">
					<strong>{row.title}</strong>
					<span>
						rev {row.revision} · {row.itemCount} items · {row.unplacedCount} unplaced · thumb
						{row.thumbnailBytes} B
					</span>
				</div>
				<div class="row-actions">
					<button type="button" onclick={() => openCard(row.id)}>Open</button>
					<button type="button" onclick={() => duplicateCard(row.id).then(refresh)}
						>Duplicate</button
					>
					<button type="button" onclick={() => removeCard(row.id)}>Delete</button>
				</div>
			</li>
		{/each}
	</ul>
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		padding: 20px;
		max-width: 720px;
	}
	.actions,
	.row-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
		margin-bottom: 12px;
	}
	.title-row {
		display: flex;
		gap: 10px;
		align-items: center;
		margin: 12px 0;
	}
	.cards {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	.cards li {
		display: grid;
		grid-template-columns: 72px 1fr;
		gap: 10px;
		border: 1px solid #c9c2b2;
		padding: 10px;
	}
	.row-actions {
		grid-column: 1 / -1;
		margin: 0;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}
	.no-thumb {
		font-size: 11px;
		color: #6e675a;
	}
</style>
