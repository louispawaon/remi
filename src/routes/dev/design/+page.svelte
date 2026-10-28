<script lang="ts">
	import { onMount } from 'svelte';
	import { createFixtureDocument } from '#lib/card/fixture';
	import { renderCard } from '#lib/card/png';
	import type { CardDocument, Format, GridSize } from '#lib/card/types';
	import { createFixtureArtwork } from '#lib/dev/artwork';

	let { data } = $props();
	const screen = $derived(data.screen);

	let editorHost = $state<HTMLElement>();
	let mobileHost = $state<HTMLElement>();
	let libA = $state<HTMLElement>();
	let libB = $state<HTMLElement>();
	let libC = $state<HTMLElement>();
	let libD = $state<HTMLElement>();
	let mobileLibA = $state<HTMLElement>();
	let mobileLibB = $state<HTMLElement>();
	let mobileLibC = $state<HTMLElement>();
	let selection = $state('');
	let mapRows = $state<{ code: string; name: string; selected: boolean }[]>([]);

	const COMP_TITLES = [
		'Frieren: Beyond Journey’s End',
		'Dungeon Meshi',
		'Vinland Saga',
		'Chainsaw Man',
		'Perfect Blue',
		'Paprika',
		'Shōgun',
		'Severance',
		'The Bear',
		'Past Lives',
		'Blue Eye Samurai',
		'Pluto'
	];

	function populate(cardDocument: CardDocument) {
		const size = cardDocument.gridSize;
		const free = cardDocument.freeSpace && size % 2 === 1 ? (size * size - 1) / 2 : -1;
		const capacity = cardDocument.slots.filter((_, index) => index !== free).length;
		const target = Math.floor(capacity * 0.75);
		const sources = cardDocument.items.filter((item) => item.artwork);
		let placed = cardDocument.slots.filter((id) => id !== null).length;
		let clone = 0;

		for (let index = 0; index < cardDocument.slots.length && placed < target; index++) {
			if (index === free || cardDocument.slots[index] !== null) continue;
			const source = sources[clone % sources.length];
			const id = `comp-${clone}`;
			cardDocument.items.push({
				...structuredClone(source),
				id,
				titleOverride: COMP_TITLES[clone % COMP_TITLES.length],
				crops: {
					...source.crops,
					[cardDocument.format]: { x: ((clone * 37) % 100) / 100, y: ((clone * 53) % 100) / 100 }
				}
			});
			cardDocument.slots[index] = id;
			placed++;
			clone++;
		}
	}

	let artworkPromise: Promise<Record<string, Blob>> | undefined;
	const artwork = () => (artworkPromise ??= createFixtureArtwork());

	async function draw(
		host: HTMLElement | undefined,
		gridSize: GridSize,
		format: Format,
		options: { selectSlot?: number; title?: string; populate?: boolean; contain?: boolean } = {}
	) {
		if (!host) return;
		const cardDocument = createFixtureDocument({ gridSize, format });
		cardDocument.title = options.title ?? 'Friday Night Rotation';
		if (options.populate) populate(cardDocument);

		const rendered = await renderCard({ document: cardDocument, artwork: await artwork() }, 1);
		const canvas = rendered.canvas;
		canvas.style.width = options.contain ? 'auto' : '100%';
		canvas.style.height = options.contain ? '100%' : 'auto';
		canvas.style.display = 'block';
		host.replaceChildren(canvas);

		const free = cardDocument.freeSpace && gridSize % 2 === 1 ? (gridSize * gridSize - 1) / 2 : -1;

		if (options.selectSlot !== undefined) {
			const cell = rendered.layout.cells[options.selectSlot];
			const layout = rendered.layout;
			selection = [
				`left:${(cell.x / layout.width) * 100}%`,
				`top:${(cell.y / layout.height) * 100}%`,
				`width:${(cell.width / layout.width) * 100}%`,
				`height:${(cell.height / layout.height) * 100}%`
			].join(';');

			mapRows = cardDocument.slots.map((id, index) => {
				const item = id ? cardDocument.items.find((candidate) => candidate.id === id) : undefined;
				return {
					code: String(index + 1).padStart(2, '0'),
					name:
						index === free
							? 'FREE'
							: item
								? (item.titleOverride ?? item.titles.preferred)
								: '— blank —',
					selected: index === options.selectSlot
				};
			});
		}
	}

	onMount(async () => {
		switch (screen) {
			case 'library':
				await Promise.all([
					draw(libA, 5, '4:5', {
						title: 'Friday Night Rotation',
						populate: true,
						contain: true
					}),
					draw(libB, 4, '3:4', { title: 'Winter Queue', populate: true, contain: true }),
					draw(libC, 3, '1:1', { title: 'Sunday Squares', populate: true, contain: true }),
					draw(libD, 5, '9:16', { title: 'Story Stack', populate: true, contain: true })
				]);
				break;
			case 'mobile-library':
				await Promise.all([
					draw(mobileLibA, 5, '4:5', {
						title: 'Friday Night Rotation',
						populate: true
					}),
					draw(mobileLibB, 4, '1:1', {
						title: 'Winter Queue',
						populate: true
					}),
					draw(mobileLibC, 4, '3:4', {
						title: 'Story Stack',
						populate: true
					})
				]);
				break;
			case 'export':
				await draw(editorHost, 5, '4:5', {
					selectSlot: 0,
					title: 'Friday Night Rotation',
					populate: true
				});
				break;
			case 'mobile':
			case 'mobile-export':
				await draw(mobileHost, 5, '4:5', {
					selectSlot: 0,
					title: 'Friday Night Rotation',
					populate: true
				});
				break;
			case 'states':
				break;
			default:
				await draw(editorHost, 5, '4:5', {
					selectSlot: 0,
					title: 'Friday Night Rotation',
					populate: true
				});
		}
		document.body.dataset.ready = 'true';
	});
</script>

<svelte:head>
	<title>Catalog comps — Remi</title>
</svelte:head>

{#snippet header(
	title = 'Friday Night Rotation',
	code = 'SHEET 01 · 5×5',
	meta = 'Saved 14:32',
	showExport = true,
	dot = true
)}
	<header class="bar">
		<div class="brand">
			<span class="wordmark">REMI</span>
			<span class="doc-code">{code}</span>
		</div>
		<div class="doc-title">{title}</div>
		<div class="bar-meta">
			{#if dot}<span class="dot"></span>{/if}
			<span>{meta}</span>
			{#if showExport}<button class="stamp" type="button">Export</button>{/if}
		</div>
	</header>
{/snippet}

{#snippet mobileHeader(title = 'Friday Night Rotation', save = 'Saved', dot = true)}
	<header class="m-header">
		<div>
			<span class="wordmark">REMI</span>
			<div class="m-title">{title}</div>
		</div>
		<div class="m-save">
			{#if dot}<span class="dot"></span>{/if}{save}
		</div>
	</header>
{/snippet}

{#snippet indexPanel()}
	<aside class="index">
		<section class="section">
			<h2>Add</h2>
			<input class="search" aria-label="Search media" placeholder="Search anime, manga, movies…" />
			<div class="chips">
				<button class="chip on" type="button">Anime</button>
				<button class="chip" type="button">Manga</button>
				<button class="chip" type="button">Manhwa</button>
				<button class="chip" type="button">Movie</button>
				<button class="chip" type="button">TV</button>
			</div>
			<div class="result">
				<span class="result-art a1"></span>
				<div>
					<div class="result-title">Tokyo Revengers</div>
					<div class="meta">ANIME · 2021</div>
				</div>
				<button class="plus" type="button" aria-label="Add Tokyo Revengers">+</button>
			</div>
			<div class="result">
				<span class="result-art a2"></span>
				<div>
					<div class="result-title">Solo Leveling</div>
					<div class="meta">MANHWA · 2018</div>
				</div>
				<button class="plus" type="button" aria-label="Add Solo Leveling">+</button>
			</div>
		</section>

		<section class="section">
			<h2>Arrange</h2>
			<div class="row">
				<span>Grid</span>
				<span class="seg">
					<button class="seg-btn" type="button">3</button>
					<button class="seg-btn" type="button">4</button>
					<button class="seg-btn on" type="button">5</button>
				</span>
			</div>
			<div class="row">
				<span>Free space</span>
				<span class="switch on" aria-hidden="true"><span></span></span>
			</div>
			<div class="row">
				<span>Shuffle</span>
				<button class="mini" type="button">Shuffle 24</button>
			</div>
			<p class="hint">Select a slot code, then a cell. No dragging.</p>
		</section>

		<section class="section">
			<h2>Style</h2>
			<div class="row">
				<span>Titles</span>
				<span class="switch on" aria-hidden="true"><span></span></span>
			</div>
			<div class="row">
				<span>Format</span>
				<span class="seg">
					<button class="seg-btn on" type="button">4:5</button>
					<button class="seg-btn" type="button">3:4</button>
					<button class="seg-btn" type="button">9:16</button>
					<button class="seg-btn" type="button">1:1</button>
				</span>
			</div>
			<div class="row">
				<span>Ground</span>
				<span class="swatches">
					<button class="swatch on" type="button" aria-label="Ink ground"></button>
					<button class="swatch s2" type="button" aria-label="Deep green ground"></button>
					<button class="swatch s3" type="button" aria-label="Bone ground"></button>
				</span>
			</div>
			<div class="row">
				<span>Face</span>
				<span class="seg">
					<button class="seg-btn on" type="button">Grotesque</button>
					<button class="seg-btn" type="button">Serif</button>
					<button class="seg-btn" type="button">Display</button>
				</span>
			</div>
		</section>
	</aside>
{/snippet}

{#snippet slotMap()}
	<aside class="margin">
		<h2>SHEET MAP</h2>
		<div class="map">
			{#each mapRows as row (row.code)}
				<div class="map-row" class:selected={row.selected}>
					<span class="code">{row.code}</span>
					<span class="map-name">{row.name}</span>
				</div>
			{/each}
		</div>
		<p class="map-note">Codes address cells directly. Tap a code, tap a cell.</p>
	</aside>
{/snippet}

{#snippet tray()}
	<footer class="tray">
		<div class="tray-left">
			<span class="label">UNPLACED · 02</span>
			<span class="unplaced"><span class="thumb t1"></span>Renamed Title</span>
			<span class="unplaced"><span class="thumb t2"></span>Unplaced Text</span>
		</div>
		<span class="note">EXCLUDED FROM PNG</span>
	</footer>
{/snippet}

{#if screen === 'library'}
	<div class="app">
		{@render header('Library', 'CATALOG · 06 SHEETS', '6 cards', false, false)}
		<main class="library">
			<div class="library-head">
				<div>
					<div class="label">LIBRARY · 06 SHEETS</div>
					<h1>Every card is a sheet.</h1>
				</div>
				<div class="library-actions">
					<button class="ghost" type="button">Import project</button>
					<button class="stamp" type="button">New card</button>
				</div>
			</div>
			<div class="library-grid">
				<article class="sheet-card">
					<div class="sheet-art" bind:this={libA}></div>
					<h3>Friday Night Rotation</h3>
					<div class="meta">5×5 · 4:5 · EDITED 14:32</div>
					<div class="sheet-actions">
						<button type="button">Open</button><button type="button">Rename</button><button
							type="button">Duplicate</button
						>
					</div>
				</article>
				<article class="sheet-card">
					<div class="sheet-art" bind:this={libB}></div>
					<h3>Winter Queue</h3>
					<div class="meta">4×4 · 3:4 · EDITED YESTERDAY</div>
					<div class="sheet-actions">
						<button type="button">Open</button><button type="button">Rename</button><button
							type="button">Duplicate</button
						>
					</div>
				</article>
				<article class="sheet-card">
					<div class="sheet-art" bind:this={libC}></div>
					<h3>Sunday Squares</h3>
					<div class="meta">3×3 · 1:1 · EDITED 2 DAYS AGO</div>
					<div class="sheet-actions">
						<button type="button">Open</button><button type="button">Rename</button><button
							type="button">Duplicate</button
						>
					</div>
				</article>
				<article class="sheet-card">
					<div class="sheet-art" bind:this={libD}></div>
					<h3>Story Stack</h3>
					<div class="meta">5×5 · 9:16 · EDITED LAST WEEK</div>
					<div class="sheet-actions">
						<button type="button">Open</button><button type="button">Rename</button><button
							type="button">Duplicate</button
						>
					</div>
				</article>
			</div>
		</main>
	</div>
{:else if screen === 'states'}
	<div class="app">
		{@render header('States', 'INTERFACE STATES', 'reference', false, false)}
		<main class="states-wrap">
			<div class="library-head">
				<div>
					<div class="label">STATES</div>
					<h1>Quiet when idle. Honest when it breaks.</h1>
				</div>
			</div>
			<div class="states">
				<section class="state">
					<div class="label">LIBRARY · EMPTY</div>
					<div class="state-body center">
						<div class="empty-grid">
							{#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as cell (cell)}<span></span>{/each}
						</div>
						<p>No sheets yet.</p>
						<button class="stamp" type="button">Make the first card</button>
					</div>
				</section>
				<section class="state">
					<div class="label">ADD · SEARCHING</div>
					<div class="state-body">
						{#each [1, 2, 3, 4] as row (row)}
							<div class="skel"><span class="skel-art"></span><span class="skel-line"></span></div>
						{/each}
						<p class="meta">Searching AniList…</p>
					</div>
				</section>
				<section class="state">
					<div class="label">ADD · PROVIDER UNAVAILABLE</div>
					<div class="state-body">
						<p class="state-title">TMDB isn’t answering.</p>
						<p class="body">
							Movies and TV are paused. Your card, uploads, and exports still work.
						</p>
						<div class="state-actions">
							<button class="stamp" type="button">Retry</button><button class="ghost" type="button"
								>Enter token</button
							>
						</div>
					</div>
				</section>
				<section class="state">
					<div class="label">SAVING</div>
					<div class="state-body">
						<p class="state-title"><span class="dot"></span> Saving…</p>
						<p class="body">Writing sheet 01 to this browser. Export stays available.</p>
						<div class="progress"><span></span></div>
					</div>
				</section>
				<section class="state">
					<div class="label">SAVE FAILED</div>
					<div class="state-body">
						<p class="state-title bad">Couldn’t save to this browser.</p>
						<p class="body">
							The card is still in memory. Export it as a project before closing the tab.
						</p>
						<div class="state-actions">
							<button class="stamp" type="button">Export project</button><button
								class="ghost"
								type="button">Retry save</button
							>
						</div>
					</div>
				</section>
				<section class="state">
					<div class="label">EXPORT · READY</div>
					<div class="state-body">
						<p class="state-title">PNG prepared.</p>
						<p class="body">1080 × 1350 · 5×5 · 2 unplaced items excluded.</p>
						<div class="state-actions">
							<button class="stamp" type="button">Save file</button><button
								class="ghost"
								type="button">Open image</button
							>
						</div>
					</div>
				</section>
			</div>
		</main>
	</div>
{:else if screen === 'mobile-library'}
	<div class="mobile-app">
		{@render mobileHeader('Library', '6 cards', false)}
		<main class="m-body">
			<div class="m-lib-head">
				<div class="label">LIBRARY · 06</div>
				<button class="stamp" type="button">New card</button>
			</div>
			<article class="m-sheet">
				<div class="m-thumb" bind:this={mobileLibA}></div>
				<div>
					<h3>Friday Night Rotation</h3>
					<div class="meta">5×5 · 4:5 · 14:32</div>
					<div class="sheet-actions">
						<button type="button">Open</button><button type="button">Duplicate</button>
					</div>
				</div>
			</article>
			<article class="m-sheet">
				<div class="m-thumb square" bind:this={mobileLibB}></div>
				<div>
					<h3>Winter Queue</h3>
					<div class="meta">4×4 · 1:1 · YESTERDAY</div>
					<div class="sheet-actions">
						<button type="button">Open</button><button type="button">Duplicate</button>
					</div>
				</div>
			</article>
			<article class="m-sheet">
				<div class="m-thumb" bind:this={mobileLibC}></div>
				<div>
					<h3>Story Stack</h3>
					<div class="meta">5×5 · 9:16 · LAST WEEK</div>
					<div class="sheet-actions">
						<button type="button">Open</button><button type="button">Duplicate</button>
					</div>
				</div>
			</article>
		</main>
	</div>
{:else if screen === 'mobile' || screen === 'mobile-export'}
	<div class="mobile-app">
		{@render mobileHeader()}
		<div class="m-preview">
			<div class="plate tight">
				<div bind:this={mobileHost}></div>
				<div class="selection" style={selection}><span class="selection-code">01</span></div>
				<span class="mark tl"></span><span class="mark tr"></span>
			</div>
		</div>
		{#if screen === 'mobile-export'}
			<section class="slip mobile-slip">
				<button class="text-btn slip-close" type="button">Cancel</button>
				<div class="label">EXPORT · PNG</div>
				<h2>Friday Night Rotation <span>4:5</span></h2>
				<div class="choice on"><span>Standard</span><span class="mono">1080 × 1350</span></div>
				<div class="choice"><span>2×</span><span class="mono">2160 × 2700</span></div>
				<p class="warn">02 unplaced items excluded from this PNG.</p>
				<div class="actions">
					<button class="stamp wide" type="button">Save PNG</button><button
						class="ghost wide"
						type="button">Share…</button
					>
				</div>
			</section>
		{:else}
			<nav class="m-tabs">
				<button type="button">Preview</button>
				<button type="button">Add</button>
				<button class="on" type="button">Arrange</button>
				<button type="button">Style</button>
			</nav>
			<section class="m-panel">
				<div class="m-panel-head">
					<span class="label">ARRANGE · 5 × 5</span><span class="meta">24 + free</span>
				</div>
				<div class="row">
					<span>Grid</span><span class="seg"
						><button class="seg-btn" type="button">3</button><button class="seg-btn" type="button"
							>4</button
						><button class="seg-btn on" type="button">5</button></span
					>
				</div>
				<div class="row">
					<span>Free space</span><span class="switch on" aria-hidden="true"><span></span></span>
				</div>
				<div class="row">
					<span>Shuffle</span><button class="mini" type="button">Shuffle 24</button>
				</div>
				<div class="m-unplaced">
					<div class="label">UNPLACED · 02</div>
					<div class="unplaced"><span class="thumb t1"></span>Renamed Title</div>
					<div class="unplaced"><span class="thumb t2"></span>Unplaced Text</div>
					<p class="hint">Tap a slot code, then a cell. Excluded from PNG.</p>
				</div>
			</section>
			<button class="m-export" type="button">Export PNG · 4:5</button>
		{/if}
	</div>
{:else}
	<div class="app">
		{@render header()}
		<div class="workspace">
			{@render indexPanel()}
			<main class="sheet">
				<div class="plate">
					<div bind:this={editorHost}></div>
					<div class="selection" style={selection}><span class="selection-code">01</span></div>
					<span class="mark tl"></span><span class="mark tr"></span>
					<span class="mark bl"></span><span class="mark br"></span>
				</div>
				<div class="sheet-foot">
					<span class="mono">PLATE 01 · 1080 × 1350 · 4:5</span>
					<span class="mono">SELECTED 01 · TOKYO REVENGERS</span>
				</div>
			</main>
			{@render slotMap()}
		</div>
		{@render tray()}
		{#if screen === 'export'}
			<div class="overlay">
				<section class="slip">
					<div class="label">EXPORT · PNG</div>
					<h2>Friday Night Rotation <span>4:5</span></h2>
					<div class="choice on"><span>Standard</span><span class="mono">1080 × 1350</span></div>
					<div class="choice"><span>2×</span><span class="mono">2160 × 2700</span></div>
					<p class="warn">02 unplaced items excluded from this PNG.</p>
					<div class="actions">
						<button class="stamp wide" type="button">Save PNG</button><button
							class="ghost wide"
							type="button">Share…</button
						><button class="text-btn" type="button">Cancel</button>
					</div>
				</section>
			</div>
		{/if}
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		background: #f1eee4;
		color: #171512;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		-webkit-font-smoothing: antialiased;
	}
	:global(*) {
		box-sizing: border-box;
	}

	.app,
	.mobile-app {
		--paper: #f1eee4;
		--ink: #171512;
		--spot: #c23b22;
		--rule: #c9c2b2;
		--muted: #6e675a;
		--panel: #eae4d6;
		--mono: ui-monospace, 'SF Mono', Menlo, monospace;
	}

	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background-image: radial-gradient(#171512 0.35px, transparent 0.35px);
		background-size: 4px 4px;
		background-blend-mode: multiply;
	}

	.bar {
		display: grid;
		grid-template-columns: 300px 1fr auto;
		align-items: center;
		gap: 24px;
		padding: 14px 24px;
		border-bottom: 1px solid var(--ink);
		background: var(--paper);
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
		letter-spacing: -0.01em;
	}
	.bar-meta {
		display: flex;
		align-items: center;
		gap: 14px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.dot {
		width: 6px;
		height: 6px;
		background: var(--spot);
		display: inline-block;
	}

	.stamp {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		background: var(--ink);
		color: var(--paper);
		border: 1px solid var(--ink);
		padding: 9px 16px;
		cursor: pointer;
	}
	.stamp:hover {
		background: var(--spot);
		border-color: var(--spot);
	}
	.ghost {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		background: transparent;
		color: var(--ink);
		border: 1px solid var(--ink);
		padding: 9px 16px;
		cursor: pointer;
	}
	.mono,
	.label,
	.meta {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.workspace {
		flex: 1;
		display: grid;
		grid-template-columns: 300px 1fr 220px;
		min-height: 0;
	}
	.index {
		border-right: 1px solid var(--rule);
		padding: 18px 18px 24px;
		background: var(--paper);
		overflow: hidden;
	}
	.section {
		padding-bottom: 16px;
		margin-bottom: 16px;
		border-bottom: 1px solid var(--rule);
	}
	.section:last-child {
		border-bottom: 0;
	}
	.section h2 {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		margin: 0 0 10px;
		font-weight: 400;
	}
	.search {
		width: 100%;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--ink);
		padding: 7px 0;
		font: inherit;
		font-size: 12px;
	}
	.search::placeholder {
		color: var(--muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 10px 0;
	}
	.chip,
	.seg-btn,
	.mini {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: transparent;
		border: 1px solid var(--rule);
		padding: 5px 7px;
		cursor: pointer;
		color: var(--ink);
	}
	.chip.on,
	.seg-btn.on {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	.result {
		display: grid;
		grid-template-columns: 30px 1fr auto;
		gap: 9px;
		align-items: center;
		padding: 7px 0;
		border-top: 1px solid var(--rule);
	}
	.result-art {
		width: 30px;
		height: 42px;
		display: block;
	}
	.a1 {
		background: linear-gradient(160deg, #b8452f, #2a1b17);
	}
	.a2 {
		background: linear-gradient(160deg, #2f6bb8, #16202c);
	}
	.result-title {
		font-size: 12px;
		font-weight: 500;
	}
	.plus {
		border: 1px solid var(--ink);
		background: transparent;
		width: 24px;
		height: 24px;
		cursor: pointer;
		line-height: 1;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 30px;
		font-size: 12px;
	}
	.seg {
		display: flex;
		gap: 3px;
	}
	.switch {
		width: 30px;
		height: 16px;
		border: 1px solid var(--ink);
		display: inline-flex;
		align-items: center;
		padding: 1px;
	}
	.switch span {
		width: 12px;
		height: 12px;
		background: var(--ink);
	}
	.switch.on {
		justify-content: flex-end;
	}
	.swatch {
		width: 18px;
		height: 18px;
		border: 1px solid var(--ink);
		background: var(--ink);
		padding: 0;
		cursor: pointer;
	}
	.swatches {
		display: flex;
		gap: 4px;
	}
	.swatch.s2 {
		background: #22402f;
	}
	.swatch.s3 {
		background: #e7dcc3;
	}
	.swatch.on {
		outline: 1px solid var(--spot);
		outline-offset: 2px;
	}
	.hint {
		font-size: 10px;
		color: var(--muted);
		margin: 8px 0 0;
		line-height: 1.4;
	}

	.sheet {
		padding: 24px 32px 18px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.plate {
		position: relative;
		width: 100%;
		max-width: 540px;
		margin: 0 auto;
		border: 1px solid var(--ink);
		background: #0d0c0b;
	}
	.selection {
		position: absolute;
		border: 2px solid var(--spot);
		pointer-events: none;
	}
	.selection-code {
		position: absolute;
		top: 0;
		left: 0;
		background: var(--spot);
		color: #fff;
		font-family: var(--mono);
		font-size: 9px;
		padding: 2px 4px;
	}
	.mark {
		position: absolute;
		width: 10px;
		height: 10px;
		pointer-events: none;
	}
	.mark.tl {
		top: -8px;
		left: -8px;
		border-top: 1px solid var(--spot);
		border-left: 1px solid var(--spot);
	}
	.mark.tr {
		top: -8px;
		right: -8px;
		border-top: 1px solid var(--spot);
		border-right: 1px solid var(--spot);
	}
	.mark.bl {
		bottom: -8px;
		left: -8px;
		border-bottom: 1px solid var(--spot);
		border-left: 1px solid var(--spot);
	}
	.mark.br {
		bottom: -8px;
		right: -8px;
		border-bottom: 1px solid var(--spot);
		border-right: 1px solid var(--spot);
	}
	.sheet-foot {
		display: flex;
		justify-content: space-between;
		max-width: 540px;
		width: 100%;
		margin: 14px auto 0;
	}

	.margin {
		border-left: 1px solid var(--rule);
		padding: 18px 14px;
		overflow: hidden;
	}
	.margin h2 {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.18em;
		margin: 0 0 8px;
		font-weight: 400;
	}
	.map-row {
		display: flex;
		gap: 8px;
		font-family: var(--mono);
		font-size: 9px;
		line-height: 1.9;
		color: var(--muted);
	}
	.map-row.selected {
		color: var(--ink);
	}
	.map-row.selected .code {
		color: var(--spot);
	}
	.code {
		width: 16px;
		flex: none;
	}
	.map-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.map-note {
		font-size: 9px;
		line-height: 1.5;
		color: var(--muted);
		margin-top: 12px;
		border-top: 1px solid var(--rule);
		padding-top: 8px;
	}

	.tray {
		border-top: 1px solid var(--ink);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 10px 24px;
	}
	.tray-left {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.unplaced {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}
	.thumb {
		width: 22px;
		height: 30px;
		display: inline-block;
	}
	.t1 {
		background: linear-gradient(150deg, #b8452f, #2a1b17);
	}
	.t2 {
		background: linear-gradient(150deg, #8f6b2f, #26221c);
	}
	.note {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.14em;
		color: var(--spot);
	}

	.library,
	.states-wrap {
		padding: 34px 40px 48px;
		max-width: 1240px;
		width: 100%;
		margin: 0 auto;
	}
	.library-head {
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
	.library-actions {
		display: flex;
		gap: 8px;
	}
	.library-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 18px;
	}
	.sheet-card {
		border: 1px solid var(--rule);
		padding: 10px;
		background: var(--paper);
	}
	.sheet-art {
		border: 1px solid var(--ink);
		margin-bottom: 10px;
		overflow: hidden;
		height: 300px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0d0c0b;
	}
	.sheet-card h3,
	.m-sheet h3 {
		font-size: 13px;
		margin: 0 0 3px;
		font-weight: 500;
	}
	.sheet-actions {
		display: flex;
		gap: 10px;
		margin-top: 8px;
	}
	.sheet-actions button {
		background: none;
		border: 0;
		padding: 0;
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-decoration: underline;
		cursor: pointer;
		color: var(--ink);
	}

	.states {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 14px;
	}
	.state {
		border: 1px solid var(--rule);
		padding: 16px;
		min-height: 180px;
	}
	.state-body {
		margin-top: 10px;
	}
	.state-body.center {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}
	.state-title {
		font-size: 18px;
		margin: 0 0 4px;
		letter-spacing: -0.01em;
	}
	.state-title.bad {
		color: var(--spot);
	}
	.body {
		font-size: 12px;
		line-height: 1.5;
		margin: 0 0 12px;
		color: #3d382e;
	}
	.state-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.empty-grid {
		display: grid;
		grid-template-columns: repeat(3, 18px);
		gap: 4px;
	}
	.empty-grid span {
		width: 18px;
		height: 18px;
		border: 1px solid var(--rule);
	}
	.empty-grid span:nth-child(5) {
		background: var(--spot);
		border-color: var(--spot);
	}
	.skel {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-bottom: 10px;
	}
	.skel-art {
		width: 28px;
		height: 38px;
		background: var(--panel);
		display: block;
	}
	.skel-line {
		height: 8px;
		width: 60%;
		background: var(--panel);
		display: block;
	}
	.progress {
		height: 2px;
		background: var(--rule);
		margin-top: 18px;
	}
	.progress span {
		display: block;
		width: 42%;
		height: 2px;
		background: var(--ink);
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(23, 21, 18, 0.34);
		display: grid;
		place-items: center;
	}
	.slip {
		width: 430px;
		background: #faf7ee;
		border: 1px solid var(--ink);
		padding: 22px 24px;
	}
	.slip h2 {
		font-size: 24px;
		margin: 8px 0 16px;
		letter-spacing: -0.02em;
		font-weight: 500;
	}
	.slip h2 span {
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		color: var(--muted);
		margin-left: 8px;
	}
	.choice {
		display: flex;
		justify-content: space-between;
		border-top: 1px solid var(--rule);
		padding: 10px 0;
		font-size: 13px;
	}
	.choice.on {
		border-top-color: var(--ink);
	}
	.choice.on span:first-child::before {
		content: '● ';
		color: var(--spot);
		font-size: 9px;
	}
	.choice:not(.on) span:first-child::before {
		content: '○ ';
		font-size: 9px;
	}
	.warn {
		font-size: 11px;
		color: var(--spot);
		margin: 14px 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}
	.wide {
		flex: 1;
	}
	.text-btn {
		background: none;
		border: 0;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-decoration: underline;
		cursor: pointer;
		color: var(--muted);
	}

	.mobile-app {
		width: 100%;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--paper);
		background-image: radial-gradient(#171512 0.35px, transparent 0.35px);
		background-size: 4px 4px;
		padding-bottom: env(safe-area-inset-bottom);
	}
	.m-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--ink);
		gap: 12px;
	}
	.m-title {
		font-size: 13px;
		font-weight: 500;
		margin-top: 2px;
	}
	.m-save {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.m-preview {
		padding: 14px 16px 10px;
	}
	.plate.tight {
		max-width: none;
		width: 300px;
		margin: 0 auto;
	}
	.m-tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
		margin-top: 8px;
	}
	.m-tabs button {
		background: transparent;
		border: 0;
		border-right: 1px solid var(--rule);
		padding: 13px 4px;
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.m-tabs button.on {
		color: var(--ink);
		background: var(--panel);
	}
	.m-panel {
		padding: 12px 16px 8px;
		flex: 1;
	}
	.m-panel-head {
		display: flex;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.m-unplaced {
		border-top: 1px solid var(--rule);
		padding-top: 10px;
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.m-export {
		position: sticky;
		bottom: 0;
		width: 100%;
		padding: 18px 16px;
		background: var(--ink);
		color: var(--paper);
		border: 0;
		border-top: 1px solid var(--ink);
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		min-height: 56px;
	}
	.m-body {
		padding: 16px;
		flex: 1;
	}
	.m-lib-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 14px;
	}
	.m-sheet {
		display: grid;
		grid-template-columns: 82px 1fr;
		gap: 12px;
		padding: 12px 0;
		border-top: 1px solid var(--rule);
	}
	.m-thumb {
		overflow: hidden;
		border: 1px solid var(--ink);
	}
	.m-thumb.square {
		aspect-ratio: 1;
	}
	.mobile-slip {
		position: relative;
		width: 100%;
		margin-top: 6px;
		border-left: 0;
		border-right: 0;
		border-bottom: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.mobile-slip .actions {
		margin-top: auto;
		padding-top: 28px;
	}
	.slip-close {
		position: absolute;
		top: 16px;
		right: 18px;
	}
</style>
