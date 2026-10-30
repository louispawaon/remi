<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { randomId } from '#lib/card/document';
	import { ADD_CATEGORIES, type CardItem, type Category } from '#lib/card/types';
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
	let narrow = $state(false);

	const search = createMediaSearch();
	const supportsFilters = $derived(
		editor.addCategory !== 'movie' &&
			editor.addCategory !== 'tv' &&
			editor.addCategory !== 'music' &&
			editor.addCategory !== 'game'
	);
	const supportsYear = $derived(
		options ? options.supportsYear : editor.addCategory !== 'music' && editor.addCategory !== 'game'
	);
	const hasFilters = $derived(
		supportsYear ||
			Boolean(options && (options.filters.length > 0 || options.titleLanguages.length > 0))
	);
	const activeFilterCount = $derived(
		(supportsYear && year.trim() ? 1 : 0) +
			Object.values(filters).filter(Boolean).length +
			(titleLanguage === 'english' ? 0 : 1)
	);

	onMount(() => {
		const query = window.matchMedia('(max-width: 900px)');
		const sync = () => (narrow = query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	$effect(() => {
		const category = editor.addCategory;
		void loadOptions(category);
	});

	$effect(() => {
		const category = editor.addCategory;
		const text = query;
		const currentPage = page;
		const currentYear = year;
		const currentFilters = filters;
		const language = titleLanguage;
		void retry;

		const yearText = supportsYear ? currentYear.trim() : '';
		if (yearText && !/^\d{4}$/.test(yearText)) {
			search.cancel();
			results = [];
			total = null;
			hasNext = false;
			loading = false;
			searchError = 'Enter a four-digit year.';
			return;
		}

		if (!text.trim()) {
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
				mode: 'search',
				query: text.trim(),
				page: currentPage,
				year: yearText ? Number(yearText) : undefined,
				genre: supportsFilters ? currentFilters.genre : undefined,
				format: supportsFilters ? currentFilters.format : undefined,
				status: supportsFilters ? currentFilters.status : undefined,
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
				titles: {
					preferred: result.title.preferred,
					alternatives: [...result.title.alternatives]
				},
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
	<h2 class="section-title">Find a poster</h2>

	<div class="search-row">
		<label class="category-field">
			<span class="visually-hidden">Category</span>
			<select
				value={editor.addCategory}
				onchange={(event) => editor.setAddCategory(event.currentTarget.value as Category)}
			>
				{#each ADD_CATEGORIES as category (category)}
					<option value={category}>{category[0].toUpperCase() + category.slice(1)}</option>
				{/each}
			</select>
		</label>
		<label class="title-field">
			<span class="visually-hidden">Title</span>
			<input
				class="input"
				data-testid="search-input"
				type="search"
				placeholder={editor.addCategory === 'music'
					? 'Search songs, albums or artists'
					: editor.addCategory === 'game'
						? 'Search games'
						: 'Search titles'}
				value={query}
				oninput={(event) => {
					query = event.currentTarget.value;
					page = 1;
				}}
			/>
		</label>
	</div>

	{#snippet filterFields()}
		<div class="filters">
			{#if supportsYear}
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
			{/if}

			{#if options}
				{#each supportsFilters ? options.filters : [] as filter (filter.key)}
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
	{/snippet}

	{#if hasFilters}
		{#if narrow}
			<details class="filters-details">
				<summary class="label"
					>Filters{#if activeFilterCount > 0}
						· {activeFilterCount}{/if}</summary
				>
				{@render filterFields()}
			</details>
		{:else}
			{@render filterFields()}
		{/if}
	{/if}

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
		<span class="label">Results</span>
		<span class="mono"
			>{loading
				? 'Loading…'
				: total === null
					? ''
					: `${total} ${total === 1 ? 'result' : 'results'}`}</span
		>
	</div>

	{#if loading}
		<div class="skeleton" aria-hidden="true">
			{#each [1, 2, 3] as row (row)}
				<span class="skel-art"></span><span class="skel-line"></span>
			{/each}
			<p class="mono">Searching…</p>
		</div>
	{:else if results.length === 0 && !query.trim()}
		<p class="hint">Type a title to search.</p>
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
								width="44"
								height="62"
							/>
						{:else}
							<span class="no-poster">NO ART</span>
						{/if}
					</div>
					<div class="result-text">
						<span class="result-title">{result.title.preferred}</span>
						<span class="meta">{[result.year, result.format].filter(Boolean).join(' · ')}</span>
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

	{#if results.length > 0}
		<div class="pager">
			<button
				class="ghost pager-btn"
				type="button"
				disabled={page <= 1 || loading}
				onclick={() => (page = Math.max(1, page - 1))}>Previous</button
			>
			<span class="mono">Page {page}</span>
			<button
				class="ghost pager-btn"
				type="button"
				disabled={!hasNext || loading}
				onclick={() => (page += 1)}>Next</button
			>
		</div>
	{/if}

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
		gap: 14px;
	}
	.search-row {
		display: flex;
		gap: 8px;
		align-items: stretch;
	}
	.category-field {
		flex: 0 0 106px;
		display: flex;
	}
	.category-field select {
		width: 100%;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.title-field {
		flex: 1;
		display: flex;
		min-width: 0;
	}
	.title-field .input {
		width: 100%;
	}
	.filters {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.filters-details {
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}
	.filters-details summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 44px;
		cursor: pointer;
		list-style: none;
	}
	.filters-details summary::-webkit-details-marker {
		display: none;
	}
	.filters-details summary::after {
		content: '▾';
		font-size: 10px;
	}
	.filters-details[open] summary::after {
		content: '▴';
	}
	.filters-details[open] summary {
		border-bottom: 1px solid var(--rule);
	}
	.filters-details .filters {
		padding: 12px 0;
	}
	@media (max-width: 900px) {
		/* The tab already says Add; the heading costs a result row on a phone. */
		.section-title {
			display: none;
		}
		.panel-body {
			gap: 10px;
		}
	}
	.filters .field,
	.filters select {
		min-width: 0;
	}
	.field.stacked {
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
	}
	.field select {
		width: 100%;
	}
	.results-head,
	.pager {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.results {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		max-height: 380px;
		overflow: auto;
		border-top: 1px solid var(--rule);
	}
	.result {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) auto;
		gap: 10px;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid var(--rule);
	}
	.poster {
		width: 44px;
		height: 62px;
		background: var(--card);
		border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.poster img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.no-poster {
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--ink-3);
		text-align: center;
	}
	.result-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.result-title {
		font-size: 13px;
		font-weight: 600;
		line-height: 1.25;
	}
	.result .meta {
		font-size: 11px;
		letter-spacing: 0.08em;
	}
	.alt {
		font-size: 11px;
		color: var(--ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.add {
		min-height: 34px;
		padding: 0 14px;
		font-size: 11px;
		box-shadow: 2px 2px 0 var(--card);
	}
	.skeleton {
		display: grid;
		grid-template-columns: 44px 1fr;
		gap: 10px;
		align-items: center;
	}
	.skel-art {
		width: 44px;
		height: 62px;
		background: rgba(12, 12, 15, 0.55);
	}
	.skel-line {
		height: 10px;
		width: 70%;
		background: rgba(246, 235, 192, 0.22);
	}
	.skeleton .mono {
		grid-column: 1 / -1;
	}
	.pager {
		border-top: 1px solid var(--rule);
		padding-top: 10px;
		align-items: center;
	}
	.pager-btn {
		min-height: 34px;
		font-size: 10px;
		padding: 0 12px;
	}
	.upload {
		border-top: 1px solid var(--rule);
		padding-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
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
		gap: 8px;
		align-items: flex-start;
		background: var(--card);
		border: 1.5px solid var(--danger);
		padding: 10px 12px;
	}
	.error-block .error-text {
		margin: 0;
	}
	.notice {
		color: var(--ink-2);
		font-size: 12px;
		margin: 0;
	}
	.hint {
		font-size: 12px;
		line-height: 1.5;
		color: var(--ink-2);
		margin: 0;
	}
	@media (max-width: 900px) {
		.category-field {
			flex-basis: 118px;
		}
		.add {
			min-height: 44px;
			padding: 0 16px;
		}
		.pager-btn {
			min-height: 44px;
		}
	}
</style>
