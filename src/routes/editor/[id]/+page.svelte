<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import logo from '#lib/assets/favicon.svg';
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
		<p class="mono">Opening sheet…</p>
	</main>
{:else}
	<div class="editor-app">
		<header class="bar">
			<div class="brand">
				<img class="logo" src={logo} alt="" />
				<button class="wordmark" type="button" onclick={() => leave()}>Remi</button>
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
				<button class="stamp desktop-export" type="button" onclick={() => (exportOpen = true)}
					>Export</button
				>
				<button
					class="stamp mobile-export"
					data-testid="mobile-export"
					type="button"
					onclick={() => (exportOpen = true)}>Export</button
				>
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
						<p class="hint">Tap a cell to select it, or use Add to hang a poster.</p>
					{/if}
				</div>
			</aside>

			<main
				class="sheet"
				class:compact={editor.tool !== 'preview'}
				class:add={editor.tool === 'add'}
				aria-label="Card preview"
			>
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

				<Preview {editor} compact={editor.tool !== 'preview'} />
			</main>

			<div class="slotmap-wrap"><SlotMap {editor} /></div>
		</div>

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
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 24px;
		padding: 12px 32px;
		border-bottom: 1px solid var(--rule);
		background: var(--ground);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		justify-self: start;
	}
	.logo {
		display: block;
		width: 26px;
		height: 26px;
		border-radius: 7px;
	}
	.wordmark {
		font-family: var(--display);
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.04em;
		text-transform: uppercase;
		padding: 4px 0;
		line-height: 1;
		text-align: left;
		justify-self: start;
	}
	.title-wrap {
		min-width: 0;
	}
	.title-input {
		width: 100%;
		border: 0;
		border-bottom: 1.5px solid transparent;
		background: transparent;
		font-family: var(--display);
		font-size: 20px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.02em;
		padding: 5px 0;
		color: var(--ink);
	}
	.title-input:hover,
	.title-input:focus {
		border-bottom-color: var(--ink);
		outline: none;
	}
	.bar-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.bar-meta .stamp {
		margin-left: 8px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ink);
		flex: none;
	}
	.dot.busy {
		background: transparent;
		border: 1.5px solid var(--ink);
	}
	.dot.bad {
		background: var(--danger);
	}
	.workspace {
		flex: 1;
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr) 240px;
		min-height: 0;
	}
	.panel {
		border-right: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		min-height: 0;
		max-height: calc(100vh - 69px);
	}
	.tabs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		padding: 12px;
		border-bottom: 1px solid var(--rule);
	}
	.tab {
		border: 1.5px solid var(--rule);
		border-radius: 999px;
		background: transparent;
		padding: 0 2px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		white-space: nowrap;
		font-family: var(--sans);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--ink-2);
		min-height: var(--touch);
	}
	.tab.on {
		background: var(--action);
		border-color: var(--action);
		color: var(--on-action);
	}
	.tab.mobile-only {
		display: none;
	}
	.panel-scroll {
		padding: 18px 16px 28px;
		overflow: auto;
	}
	.sheet {
		padding: 20px 32px 24px;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}
	.sheet-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: 560px;
		width: 100%;
		margin: 0 auto;
	}
	.zoom {
		display: flex;
		gap: 4px;
	}
	.zoom .seg-btn {
		min-height: 32px;
		font-size: 10px;
		padding: 0 11px;
	}
	.slotmap-wrap {
		display: contents;
	}
	.mobile-export {
		display: none;
	}
	.hint {
		font-size: 12px;
		line-height: 1.5;
		color: var(--ink-2);
		margin: 0;
	}
	.load-state {
		padding: 48px 32px;
		max-width: 680px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
	}
	@media (max-width: 1200px) {
		.workspace {
			grid-template-columns: 300px minmax(0, 1fr) 210px;
		}
	}
	@media (max-width: 1000px) {
		.workspace {
			grid-template-columns: 280px minmax(0, 1fr);
		}
		.slotmap-wrap {
			display: none;
		}
	}
	@media (max-width: 900px) {
		.bar {
			grid-template-columns: 1fr auto;
			padding: 10px 16px;
			gap: 8px;
		}
		.wordmark {
			font-size: 18px;
		}
		.logo {
			width: 24px;
			height: 24px;
		}
		.title-wrap {
			grid-column: 1 / -1;
			grid-row: 2;
		}
		.title-input {
			font-size: 17px;
		}
		.bar-meta {
			grid-column: 2;
			grid-row: 1;
		}
		.bar-meta .desktop-export {
			display: none;
		}
		.bar-meta .mobile-export {
			display: inline-flex;
			min-height: 44px;
			padding: 0 14px;
			font-size: 11px;
			letter-spacing: 0.08em;
		}
		.workspace {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
		.sheet {
			order: 1;
			padding: 14px 14px 6px;
			overflow: visible;
			gap: 10px;
		}
		.sheet-head {
			padding: 0 2px;
		}
		.sheet-head > .mono {
			display: none;
		}
		.sheet-head {
			justify-content: flex-end;
		}
		.sheet.compact {
			padding: 6px 14px 2px;
		}
		.sheet.compact .sheet-head {
			display: none;
		}
		.panel {
			order: 2;
			border-right: 0;
			border-top: 1px solid var(--rule);
			max-height: none;
			flex: 1;
		}
		.tab.mobile-only {
			display: block;
		}
		.tabs {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			background: var(--ground-deep);
			padding: 4px;
			border-radius: 999px;
			gap: 2px;
			margin-top: 10px;
		}
		.tab {
			border: 0;
			background: transparent;
		}
		.panel-scroll {
			padding: 16px 16px 32px;
		}
	}
</style>
