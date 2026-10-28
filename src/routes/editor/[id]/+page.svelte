<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { FORMAT_SIZES } from '#lib/card/layout';
	import { loadCard } from '#lib/library/store';
	import AddPanel from '#lib/editor/AddPanel.svelte';
	import ArrangePanel from '#lib/editor/ArrangePanel.svelte';
	import { EditorState, statusLabel, type EditorTool } from '#lib/editor/editor-state.svelte';
	import ExportSlip from '#lib/editor/ExportSlip.svelte';
	import Preview from '#lib/editor/Preview.svelte';
	import SlotMap from '#lib/editor/SlotMap.svelte';
	import StylePanel from '#lib/editor/StylePanel.svelte';

	let editor = $state<EditorState | null>(null);
	let loadError = $state<string | null>(null);
	let exportOpen = $state(false);
	let allowLeave = false;
	let leaving = false;

	const leaveWarning =
		'This card is not saved. Leave and lose the changes in this tab? Export the project first to keep them.';

	beforeNavigate((navigation) => {
		if (allowLeave) {
			allowLeave = false;
			return;
		}
		if (!editor || editor.status === 'saved') return;
		navigation.cancel();
		if (navigation.willUnload) {
			void editor.flush();
		} else if (navigation.to) {
			void leave(navigation.to.url, navigation.type === 'popstate' ? navigation.delta : undefined);
		}
	});

	const tabs: { id: EditorTool; label: string; mobileOnly?: boolean }[] = [
		{ id: 'preview', label: 'Preview', mobileOnly: true },
		{ id: 'add', label: 'Add' },
		{ id: 'arrange', label: 'Arrange' },
		{ id: 'style', label: 'Style' }
	];

	function flushOnPageHide() {
		void editor?.flush();
	}

	function flushOnVisibility() {
		if (document.visibilityState === 'hidden') void editor?.flush();
	}

	onMount(() => {
		void (async () => {
			try {
				const record = await loadCard(page.params.id ?? '');
				if (!record) {
					await goto(resolve('/'), { replaceState: true });
					return;
				}
				const instance = new EditorState(record);
				instance.setTool(record.document.items.length === 0 ? 'add' : 'arrange');
				editor = instance;
			} catch (error) {
				loadError = error instanceof Error ? error.message : String(error);
			}
		})();

		window.addEventListener('pagehide', flushOnPageHide);
		document.addEventListener('visibilitychange', flushOnVisibility);
		return () => {
			window.removeEventListener('pagehide', flushOnPageHide);
			document.removeEventListener('visibilitychange', flushOnVisibility);
		};
	});

	onDestroy(() => {
		editor?.dispose();
	});

	async function leave(url: string | URL = resolve('/'), delta?: number) {
		if (leaving) return;
		leaving = true;
		try {
			await editor?.flush();
			if (editor && editor.status !== 'saved' && !window.confirm(leaveWarning)) return;
			allowLeave = true;
			if (delta) window.history.go(delta);
			else {
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- SvelteKit's URL already includes the base path.
				await goto(url);
			}
		} finally {
			leaving = false;
		}
	}
</script>

<svelte:head>
	<title>{editor ? `${editor.document.title} — Remi` : 'Editor — Remi'}</title>
</svelte:head>

{#if loadError}
	<main class="load-state">
		<h1 class="section-title">Editor</h1>
		<p class="error-text" role="alert">{loadError}</p>
		<a class="ghost" href={resolve('/')}>Back to library</a>
	</main>
{:else if !editor}
	<main class="load-state">
		<p class="mono">Opening card…</p>
	</main>
{:else}
	<div class="editor-app">
		<header class="bar">
			<div class="brand">
				<button class="wordmark" type="button" onclick={() => leave()}>REMI</button>
				<span class="doc-code">{editor.document.gridSize}×{editor.document.gridSize} GRID</span>
			</div>

			<label class="title-wrap">
				<span class="visually-hidden">Card title</span>
				<input
					class="title-input"
					data-testid="title"
					type="text"
					value={editor.document.title}
					oninput={(event) => {
						editor?.setTitle(event.currentTarget.value);
						if (editor?.editError && event.currentTarget.value !== editor.document.title) {
							event.currentTarget.value = editor.document.title;
						}
					}}
				/>
			</label>

			<div class="bar-meta">
				<span
					class="dot"
					class:busy={editor.status === 'saving'}
					class:bad={editor.status === 'error' || editor.status === 'conflict'}
				></span>
				<span data-testid="save-status" aria-live="polite"
					>{statusLabel(editor.status, editor.statusDetail)}</span
				>
				<button class="stamp" type="button" onclick={() => (exportOpen = true)}>Export</button>
			</div>
		</header>

		{#if editor.editError}
			<div class="banner" role="alert">
				{editor.editError} Your last accepted edit is unchanged.
			</div>
		{/if}

		{#if editor.status === 'error' || editor.status === 'conflict'}
			<div class="banner" role="alert">
				<span>
					{editor.status === 'conflict'
						? 'This card changed in another tab. Reload before editing further.'
						: (editor.statusDetail ?? 'That save failed.')}
					Your work is still in memory and can be exported.
				</span>
				<span class="banner-actions">
					<button class="text-action" type="button" onclick={() => void editor?.flush()}
						>Retry save</button
					>
					<button class="text-action" type="button" onclick={() => (exportOpen = true)}
						>Export project</button
					>
					{#if editor.status === 'conflict'}
						<button
							class="text-action"
							type="button"
							onclick={() => {
								if (window.confirm(leaveWarning)) {
									allowLeave = true;
									window.location.reload();
								}
							}}>Reload card</button
						>
					{/if}
				</span>
			</div>
		{/if}

		<div class="workspace">
			<aside class="panel" aria-label="Tools">
				<nav class="tabs" data-testid="tabs" aria-label="Editor tools">
					{#each tabs as tab (tab.id)}
						<button
							type="button"
							class="tab"
							class:mobile-only={tab.mobileOnly}
							class:on={editor.tool === tab.id}
							aria-pressed={editor.tool === tab.id}
							onclick={() => editor?.setTool(tab.id)}>{tab.label}</button
						>
					{/each}
				</nav>

				<div class="panel-scroll">
					<div hidden={editor.tool !== 'add'}><AddPanel {editor} /></div>
					<div hidden={editor.tool !== 'arrange'}><ArrangePanel {editor} /></div>
					<div hidden={editor.tool !== 'style'}><StylePanel {editor} /></div>
					{#if editor.tool === 'preview'}
						<p class="hint">Tap a cell to select it, or use Add to place media.</p>
					{/if}
				</div>
			</aside>

			<main class="sheet" aria-label="Card preview">
				<h1 class="visually-hidden">{editor.document.title || 'Untitled card'}</h1>
				<div class="sheet-head">
					<span class="mono">
						{FORMAT_SIZES[editor.document.format][0]} × {FORMAT_SIZES[editor.document.format][1]}
						· {editor.document.format}
					</span>
					<span class="zoom">
						<button
							class="seg-btn"
							class:on={editor.zoom === 'fit'}
							type="button"
							onclick={() => editor?.setZoom('fit')}>Fit</button
						>
						<button
							class="seg-btn"
							class:on={editor.zoom === 'actual'}
							type="button"
							onclick={() => editor?.setZoom('actual')}>100%</button
						>
					</span>
				</div>

				<Preview {editor} />

				<div class="sheet-foot">
					<span class="mono">{String(editor.document.items.length).padStart(2, '0')} items</span>
					<span class="mono">{String(editor.unplaced.length).padStart(2, '0')} unplaced</span>
				</div>
			</main>

			<div class="slotmap-wrap"><SlotMap {editor} /></div>
		</div>

		<footer class="tray">
			<span class="label">Unplaced · {String(editor.unplaced.length).padStart(2, '0')}</span>
			<span class="tray-items">
				{#each editor.unplaced as item (item.id)}
					<button
						class="text-action"
						type="button"
						draggable="true"
						onclick={() => editor?.beginMove(item.id)}
						ondragstart={(event) => {
							event.dataTransfer?.setData('text/plain', item.id);
							if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
							editor?.beginMove(item.id);
						}}
						ondragend={() => editor?.cancelMove()}
						>{item.titleOverride ?? item.titles.preferred}</button
					>
				{:else}
					<span class="mono">Nothing waiting</span>
				{/each}
			</span>
			<span class="note">Excluded from PNG</span>
		</footer>

		<button
			class="mobile-export stamp"
			data-testid="mobile-export"
			type="button"
			onclick={() => (exportOpen = true)}
		>
			Export PNG · {editor.document.format}
		</button>

		{#if exportOpen}
			<ExportSlip {editor} onClose={() => (exportOpen = false)} />
		{/if}
	</div>
{/if}

<style>
	.editor-app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.bar {
		display: grid;
		grid-template-columns: 300px 1fr auto;
		align-items: center;
		gap: 20px;
		padding: 12px 24px;
		border-bottom: 1px solid var(--ink);
		background: var(--paper);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.brand {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}
	.wordmark {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.24em;
		background: none;
		border: 0;
		padding: 2px 0;
		text-align: left;
	}
	.doc-code {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.14em;
		color: var(--muted);
	}
	.title-wrap {
		min-width: 0;
	}
	.title-input {
		width: 100%;
		border: 0;
		border-bottom: 1px solid transparent;
		background: transparent;
		font-size: 15px;
		font-weight: 500;
		padding: 4px 0;
	}
	.title-input:hover,
	.title-input:focus {
		border-bottom-color: var(--ink);
	}
	.bar-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.dot {
		width: 6px;
		height: 6px;
		background: var(--spot);
	}
	.dot.busy {
		background: var(--ink);
	}
	.dot.bad {
		background: var(--spot);
		outline: 2px solid var(--spot);
		outline-offset: 2px;
	}
	.banner {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: center;
		flex-wrap: wrap;
		padding: 8px 24px;
		border-bottom: 1px solid var(--spot);
		background: #f7e9e4;
		font-size: 12px;
	}
	.banner-actions {
		display: flex;
		gap: 14px;
	}
	.workspace {
		flex: 1;
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr) 220px;
		min-height: 0;
	}
	.panel {
		border-right: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		min-height: 0;
		max-height: calc(100vh - 64px);
	}
	.tabs {
		display: flex;
		border-bottom: 1px solid var(--ink);
	}
	.tab {
		flex: 1;
		border: 0;
		border-right: 1px solid var(--rule);
		background: transparent;
		padding: 11px 4px;
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		min-height: var(--touch);
	}
	.tab.on {
		background: var(--panel);
		color: var(--ink);
	}
	.tab.mobile-only {
		display: none;
	}
	.panel-scroll {
		padding: 14px 16px 24px;
		overflow: auto;
	}
	.sheet {
		padding: 18px 28px;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.sheet-head,
	.sheet-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: 540px;
		width: 100%;
		margin: 0 auto;
	}
	.zoom {
		display: flex;
		gap: 3px;
	}
	.tray {
		border-top: 1px solid var(--ink);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 24px;
		flex-wrap: wrap;
	}
	.tray-items {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
	}
	.note {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.14em;
		color: var(--spot);
	}
	.slotmap-wrap {
		display: contents;
	}
	.mobile-export {
		display: none;
	}
	.hint {
		font-size: 11px;
		line-height: 1.5;
		color: var(--muted);
	}
	.load-state {
		padding: 48px 24px;
		max-width: 680px;
	}
	@media (max-width: 1100px) {
		.workspace {
			grid-template-columns: 280px minmax(0, 1fr) 180px;
		}
	}
	@media (max-width: 900px) {
		.bar {
			grid-template-columns: 1fr auto;
			padding: 10px 16px;
			gap: 8px;
		}
		.doc-code,
		.zoom,
		.tray,
		.sheet-head {
			display: none;
		}
		.title-wrap {
			grid-column: 1 / -1;
			grid-row: 2;
		}
		.title-input {
			font-size: 14px;
		}
		.bar-meta {
			grid-column: 2;
			grid-row: 1;
		}
		.bar-meta .stamp {
			display: none;
		}
		.workspace {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
		.slotmap-wrap {
			display: none;
		}
		.sheet {
			order: 1;
			padding: 12px 14px 8px;
			overflow: visible;
		}
		.sheet-foot {
			display: none;
		}
		.panel {
			order: 2;
			border-right: 0;
			border-top: 1px solid var(--ink);
			max-height: none;
			flex: 1;
		}
		.tab.mobile-only {
			display: block;
		}
		.panel-scroll {
			padding: 12px 16px 90px;
		}
		.mobile-export {
			display: block;
			position: sticky;
			bottom: 0;
			width: 100%;
			min-height: 56px;
			padding: 16px;
			padding-bottom: max(16px, env(safe-area-inset-bottom));
			border: 0;
			border-top: 1px solid var(--ink);
			z-index: 20;
		}
	}
</style>
