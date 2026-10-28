<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { randomId } from '#lib/card/document';
	import { CATEGORIES, type CardItem } from '#lib/card/types';
	import {
		createMediaSearch,
		fetchMediaOptions,
		imageUrl,
		type MediaClientError
	} from '#lib/media/client';
	import type { MediaOptions } from '#lib/media/types';
	import { fetchProviderArtwork, normalizeArtwork } from '#lib/media/artwork';
	import type { MediaResult } from '#lib/media/types';
	import type { EditorState } from './editor-state.svelte';

	let { editor }: { editor: EditorState } = $props();

	let options = $state<MediaOptions | null>(null);
	let optionsError = $state<string | null>(null);
	let mode = $state<'search' | 'browse'>('search');
	let query = $state('');
	let page = $state(1);
	let year = $state('');
	let filters = $state<Record<string, string>>({});
	let titleLanguage = $state('english');
	let results = $state<MediaResult[]>([]);
	let total = $state<number | null>(null);
	let hasNext = $state(false);
	let loading = $state(false);
	let searchError = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let addError = $state<string | null>(null);
	let adding = $state<string | null>(null);
	let uploadError = $state<string | null>(null);
	let retry = $state(0);
	let optionsToken = 0;

	const search = createMediaSearch();

	$effect(() => {
		const category = editor.addCategory;
		void loadOptions(category);
	});

	$effect(() => {
		const category = editor.addCategory;
		const currentMode = mode;
		const text = query;
		const currentPage = page;
		const currentYear = year;
		const currentFilters = filters;
		const language = titleLanguage;
		void retry;

		const yearText = currentYear.trim();
		if (yearText && !/^\d{4}$/.test(yearText)) {
			search.cancel();
			results = [];
			total = null;
			hasNext = false;
			loading = false;
			searchError = 'Enter a four-digit year.';
			return;
		}

		if (currentMode === 'search' && !text.trim()) {
			search.cancel();
			results = [];
			total = null;
			loading = false;
			hasNext = false;
			return;
		}

		loading = true;
		searchError = null;
		total = null;
		hasNext = false;
		search.schedule(
			{
				category,
				mode: currentMode,
				query: currentMode === 'search' ? text.trim() : undefined,
				page: currentPage,
				year: currentYear ? Number(currentYear) : undefined,
				genre: currentFilters.genre,
				format: currentFilters.format,
				status: currentFilters.status,
				titleLanguage: language as 'english' | 'romaji' | 'native'
			},
			{
				onResult: (result) => {
					results = result.results;
					total = result.total;
					hasNext = result.hasNextPage;
					loading = false;
				},
				onError: (error: MediaClientError) => {
					searchError = error.message;
					results = [];
					total = null;
					hasNext = false;
					loading = false;
					if (error.code === 'provider_credentials_missing') optionsError = error.message;
				}
			}
		);
	});

	onDestroy(() => search.cancel());

	async function loadOptions(category: typeof editor.addCategory) {
		const ticket = ++optionsToken;
		options = null;
		optionsError = null;
		filters = {};
		page = 1;
		results = [];
		total = null;
		hasNext = false;
		loading = false;
		searchError = null;
		try {
			const loaded = await fetchMediaOptions(category);
			if (ticket === optionsToken) {
				options = loaded;
				if (!loaded.titleLanguages.some((option) => option.value === titleLanguage)) {
					titleLanguage = 'english';
				}
			}
		} catch (error) {
			if (ticket === optionsToken) {
				optionsError = error instanceof Error ? error.message : String(error);
			}
		}
	}

	function setMode(next: 'search' | 'browse') {
		mode = next;
		page = 1;
		results = [];
		searchError = null;
	}

	function setFilter(key: string, value: string) {
		filters = { ...filters, [key]: value };
		page = 1;
	}

	function errorRetry() {
		retry += 1;
	}

	async function addResult(result: MediaResult) {
		const key = `${result.provider}:${result.providerId}`;
		adding = key;
		addError = null;
		notice = null;
		try {
			const normalized = result.coverPath
				? await fetchProviderArtwork(result.provider, result.coverPath)
				: null;
			const artworkId = randomId();
			const item: CardItem = {
				id: randomId(),
				category: result.category,
				sourceId: `${result.provider}:${result.providerId}`,
				titles: { preferred: result.title.preferred, alternatives: result.title.alternatives },
				titleOverride: null,
				artwork: normalized
					? {
							id: artworkId,
							type: normalized.type,
							width: normalized.width,
							height: normalized.height
						}
					: null,
				crops: {}
			};
			editor.addItem(item, normalized?.blob ?? null);
			notice = `Added ${result.title.preferred}`;
		} catch (error) {
			addError = error instanceof Error ? error.message : String(error);
		} finally {
			adding = null;
		}
	}

	async function upload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploadError = null;
		notice = null;
		try {
			const normalized = await normalizeArtwork(file, file.type);
			const title = file.name.replace(/\.[^.]+$/, '') || 'Upload';
			const item: CardItem = {
				id: randomId(),
				category: editor.addCategory,
				sourceId: null,
				titles: { preferred: title, alternatives: [] },
				titleOverride: null,
				artwork: {
					id: randomId(),
					type: normalized.type,
					width: normalized.width,
					height: normalized.height
				},
				crops: {}
			};
			editor.addItem(item, normalized.blob);
			notice = `Added ${title}`;
		} catch (error) {
			uploadError = error instanceof Error ? error.message : String(error);
		} finally {
			input.value = '';
		}
	}
</script>

<section class="panel-body" aria-label="Add media">
	<h2 class="section-title">Add</h2>

	<div class="chip-row" aria-label="Category">
		{#each CATEGORIES as category (category)}
			<button
				type="button"
				class="chip"
				class:on={editor.addCategory === category}
				aria-pressed={editor.addCategory === category}
				onclick={() => editor.setAddCategory(category)}
				>{category[0].toUpperCase() + category.slice(1)}</button
			>
		{/each}
	</div>

	<div class="seg mode" aria-label="Search or browse">
		<button
			type="button"
			class="seg-btn"
			class:on={mode === 'search'}
			aria-pressed={mode === 'search'}
			onclick={() => setMode('search')}>Search</button
		>
		<button
			type="button"
			class="seg-btn"
			class:on={mode === 'browse'}
			aria-pressed={mode === 'browse'}
			onclick={() => setMode('browse')}>Browse</button
		>
	</div>

	{#if mode === 'search'}
		<label class="field stacked">
			<span class="label">Title</span>
			<input
				class="input"
				data-testid="search-input"
				type="search"
				placeholder="Search titles…"
				value={query}
				oninput={(event) => {
					query = event.currentTarget.value;
					page = 1;
				}}
			/>
		</label>
	{:else}
		<p class="mode-note">Browsing the provider catalog by popularity, not the current page.</p>
	{/if}

	<div class="filters">
		<label class="field stacked">
			<span class="label">Year</span>
			<input
				class="input"
				type="number"
				inputmode="numeric"
				min="1900"
				max="2100"
				placeholder="Any"
				value={year}
				oninput={(event) => {
					year = event.currentTarget.value;
					page = 1;
				}}
			/>
		</label>

		{#if options}
			{#each options.filters as filter (filter.key)}
				<label class="field stacked">
					<span class="label">{filter.label}</span>
					<select
						value={filters[filter.key] ?? ''}
						onchange={(event) => setFilter(filter.key, event.currentTarget.value)}
					>
						<option value="">Any</option>
						{#each filter.options as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
			{/each}

			{#if options.titleLanguages.length > 0}
				<label class="field stacked">
					<span class="label">Title language</span>
					<select
						value={titleLanguage}
						onchange={(event) => {
							titleLanguage = event.currentTarget.value;
							page = 1;
						}}
					>
						{#each options.titleLanguages as language (language.value)}
							<option value={language.value}>{language.label}</option>
						{/each}
					</select>
				</label>
			{/if}
		{/if}
	</div>

	{#if optionsError}
		<div class="error-block" role="status">
			<p class="error-text">{optionsError}</p>
			<a class="text-action" href={resolve('/credits')}>Credits and setup</a>
		</div>
	{/if}

	{#if searchError}
		<div class="error-block" role="alert">
			<p class="error-text">{searchError}</p>
			<button class="text-action" type="button" onclick={errorRetry}>Retry</button>
		</div>
	{/if}

	<div class="results-head">
		<span class="label">{mode === 'search' ? 'Search results' : 'Browse · popular'}</span>
		<span class="mono">{loading ? 'Loading…' : total === null ? '' : `${total} results`}</span>
	</div>

	{#if loading}
		<div class="skeleton" aria-hidden="true">
			{#each [1, 2, 3] as row (row)}
				<span class="skel-art"></span><span class="skel-line"></span>
			{/each}
			<p class="mono">Searching…</p>
		</div>
	{:else if results.length === 0 && mode === 'search' && !query.trim()}
		<p class="hint">Type a title, or switch to Browse.</p>
	{:else if results.length === 0 && !searchError}
		<p class="hint">No results on this page.</p>
	{:else}
		<ul class="results" data-testid="results">
			{#each results as result (`${result.provider}:${result.providerId}`)}
				{@const key = `${result.provider}:${result.providerId}`}
				<li class="result" data-testid="result">
					<div class="poster">
						{#if result.coverPath}
							<img
								src={imageUrl(result.provider, result.coverPath)}
								alt=""
								loading="lazy"
								width="38"
								height="56"
							/>
						{:else}
							<span class="no-poster">NO POSTER</span>
						{/if}
					</div>
					<div class="result-text">
						<span class="result-title">{result.title.preferred}</span>
						<span class="meta">
							{[result.year, result.format, result.category].filter(Boolean).join(' · ')}
						</span>
						{#if result.title.alternatives.length > 0}
							<span class="alt">{result.title.alternatives[0]}</span>
						{/if}
					</div>
					<button
						class="stamp add"
						type="button"
						disabled={adding !== null}
						onclick={() => addResult(result)}
					>
						{adding === key ? 'Adding…' : 'Add'}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="pager">
		<button
			class="ghost"
			type="button"
			disabled={page <= 1 || loading}
			onclick={() => (page = Math.max(1, page - 1))}>Previous</button
		>
		<span class="mono">Page {page}</span>
		<button class="ghost" type="button" disabled={!hasNext || loading} onclick={() => (page += 1)}
			>Next</button
		>
	</div>

	{#if addError}<p class="error-text" role="alert">{addError}</p>{/if}
	{#if notice}<p class="notice" role="status">{notice}</p>{/if}

	<div class="upload">
		<p class="label">Or upload your own</p>
		<label class="ghost file-label">
			Upload image
			<input
				class="visually-hidden"
				data-testid="add-upload"
				type="file"
				accept="image/png,image/jpeg,image/webp"
				onchange={upload}
			/>
		</label>
		{#if uploadError}<p class="error-text" role="alert">{uploadError}</p>{/if}
	</div>
</section>

<style>
	.panel-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.mode {
		align-self: flex-start;
	}
	.mode-note {
		margin: 0;
		font-size: 11px;
		line-height: 1.5;
		color: var(--muted);
	}
	.filters {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.field.stacked {
		flex-direction: column;
		align-items: stretch;
		gap: 3px;
	}
	.field select {
		width: 100%;
	}
	.results-head,
	.pager {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.results {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		max-height: 340px;
		overflow: auto;
	}
	.result {
		display: grid;
		grid-template-columns: 38px 1fr auto;
		gap: 9px;
		align-items: center;
		padding: 7px 0;
		border-top: 1px solid var(--rule);
	}
	.poster {
		width: 38px;
		min-height: 56px;
		background: #0d0c0b;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.poster img {
		display: block;
		width: 38px;
		height: 56px;
		object-fit: cover;
	}
	.no-poster {
		font-family: var(--mono);
		font-size: 7px;
		color: var(--muted);
		text-align: center;
	}
	.result-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.result-title {
		font-size: 12px;
		font-weight: 500;
		line-height: 1.25;
	}
	.alt {
		font-size: 10px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.add {
		min-height: 30px;
		padding: 5px 9px;
	}
	.skeleton {
		display: grid;
		grid-template-columns: 38px 1fr;
		gap: 8px;
		align-items: center;
	}
	.skel-art {
		width: 38px;
		height: 56px;
		background: var(--panel);
	}
	.skel-line {
		height: 8px;
		width: 70%;
		background: var(--panel);
	}
	.skeleton .mono {
		grid-column: 1 / -1;
	}
	.pager {
		border-top: 1px solid var(--rule);
		padding-top: 8px;
	}
	.upload {
		border-top: 1px solid var(--rule);
		padding-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: flex-start;
	}
	.file-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.error-block {
		display: flex;
		flex-direction: column;
		gap: 4px;
		border: 1px solid var(--spot);
		padding: 8px;
	}
	.notice {
		color: var(--muted);
		font-size: 11px;
		margin: 0;
	}
	.hint {
		font-size: 10px;
		line-height: 1.5;
		color: var(--muted);
		margin: 0;
	}
</style>
