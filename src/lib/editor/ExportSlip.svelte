<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { unplacedItems } from '#lib/card/document';
	import { FORMAT_SIZES } from '#lib/card/layout';
	import { createProjectArchive } from '#lib/card/archive';
	import { renderCardPng, type RenderStage } from '#lib/card/png';
	import type { CardRecord } from '#lib/card/types';
	import type { EditorState } from './editor-state.svelte';

	let { editor, onClose }: { editor: EditorState; onClose: () => void } = $props();

	const snapshot: CardRecord = untrack(() => editor.record);
	const unplaced = unplacedItems(snapshot.document);
	const [standardWidth, standardHeight] = FORMAT_SIZES[snapshot.document.format];

	let dialog = $state<HTMLDialogElement>();
	let resolution = $state<1 | 2>(1);
	let prepared = $state<{ blob: Blob; width: number; height: number } | null>(null);
	let preparing = $state(true);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let stage = $state<RenderStage | 'idle'>('idle');
	let cancelling = $state(false);
	let completed = $state(0);
	let total = $state(0);
	let retry = $state(0);
	let token = 0;
	let objectUrl: string | null = null;
	let controller: AbortController | null = null;

	$effect(() => {
		const selected = resolution;
		void retry;

		controller?.abort();
		const active = new AbortController();
		controller = active;
		const ticket = ++token;

		preparing = true;
		cancelling = false;
		error = null;
		notice = null;
		prepared = null;
		stage = 'fonts';
		completed = 0;
		total = 0;

		void (async () => {
			try {
				const rendered = await renderCardPng(snapshot, selected, {
					signal: active.signal,
					onProgress: (next, done, count) => {
						if (ticket !== token) return;
						stage = next;
						if (done !== undefined) completed = done;
						if (count !== undefined) total = count;
					}
				});
				if (ticket !== token) return;
				prepared = {
					blob: rendered.blob,
					width: rendered.layout.width,
					height: rendered.layout.height
				};
				stage = 'idle';
			} catch (failure) {
				if (ticket !== token) return;
				if (failure instanceof DOMException && failure.name === 'AbortError') {
					notice = 'Preparation cancelled.';
				} else {
					error = failure instanceof Error ? failure.message : String(failure);
				}
			} finally {
				if (ticket === token) preparing = false;
			}
		})();

		return () => active.abort();
	});

	function stageLabel(): string {
		if (cancelling) return 'Cancelling…';
		switch (stage) {
			case 'fonts':
				return 'Loading fonts…';
			case 'artwork':
				return total > 0 ? `Loading artwork ${completed}/${total}…` : 'Loading artwork…';
			case 'drawing':
				return 'Drawing card…';
			case 'encoding':
				return 'Encoding PNG…';
			default:
				return 'Preparing…';
		}
	}

	function cancelPreparation() {
		cancelling = true;
		controller?.abort();
	}

	function retryPreparation() {
		retry += 1;
	}

	onMount(() => {
		dialog?.showModal();
		return () => {
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	});

	onDestroy(() => {
		token += 1;
		controller?.abort();
		if (dialog?.open) dialog.close();
	});

	function download(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	function filename(extension: string) {
		const slug =
			snapshot.document.title
				.toLocaleLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'remi-card';
		return `${slug}-${resolution}x.${extension}`;
	}

	function savePng() {
		if (prepared) download(prepared.blob, filename('png'));
	}

	function openImage() {
		if (!prepared) return;
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		const url = URL.createObjectURL(prepared.blob);
		objectUrl = url;
		window.open(url, '_blank');
		setTimeout(() => {
			if (objectUrl === url) {
				URL.revokeObjectURL(url);
				objectUrl = null;
			}
		}, 60_000);
	}

	async function share() {
		if (!prepared) return;
		notice = null;
		error = null;
		const file = new File([prepared.blob], filename('png'), { type: 'image/png' });
		try {
			if (!navigator.canShare?.({ files: [file] })) {
				notice = 'Sharing files is unavailable here. Save the PNG instead.';
				return;
			}
			await navigator.share({ files: [file], title: snapshot.document.title });
		} catch (failure) {
			if (failure instanceof DOMException && failure.name === 'AbortError') return;
			notice = 'Sharing did not complete. Save the PNG instead.';
		}
	}

	async function exportProject() {
		error = null;
		try {
			const bytes = await createProjectArchive(snapshot);
			download(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), filename('remi'));
		} catch (failure) {
			error = failure instanceof Error ? failure.message : String(failure);
		}
	}
</script>

<dialog
	bind:this={dialog}
	data-testid="export-dialog"
	class="slip"
	aria-labelledby="export-title"
	oncancel={(event) => {
		event.preventDefault();
		onClose();
	}}
>
	<div class="head">
		<span class="label">Export · PNG</span>
		<button class="text-action" type="button" onclick={onClose}>Cancel</button>
	</div>

	<h2 id="export-title">{snapshot.document.title}</h2>
	<p class="meta">
		{snapshot.document.format} · {snapshot.document.gridSize}×{snapshot.document.gridSize}
	</p>

	<button
		type="button"
		class="choice"
		class:on={resolution === 1}
		aria-pressed={resolution === 1}
		onclick={() => (resolution = 1)}
	>
		<span>Standard</span><span class="mono">{standardWidth} × {standardHeight}</span>
	</button>
	<button
		type="button"
		class="choice"
		class:on={resolution === 2}
		aria-pressed={resolution === 2}
		onclick={() => (resolution = 2)}
	>
		<span>2×</span><span class="mono">{standardWidth * 2} × {standardHeight * 2}</span>
	</button>

	{#if unplaced.length > 0}
		<p class="warn">
			{String(unplaced.length).padStart(2, '0')} unplaced item{unplaced.length === 1 ? '' : 's'} excluded
			from this PNG.
		</p>
	{/if}

	{#if preparing}
		<div class="prep">
			<p class="status" role="status" data-testid="prep-stage">{stageLabel()}</p>
			<div class="prep-track" aria-hidden="true">
				<span
					style={`width:${stage === 'artwork' && total > 0 ? Math.round((completed / total) * 100) : 100}%`}
				></span>
			</div>
			<button
				class="text-action"
				data-testid="cancel-preparation"
				type="button"
				disabled={cancelling}
				onclick={cancelPreparation}>{cancelling ? 'Cancelling…' : 'Cancel preparation'}</button
			>
		</div>
	{:else if prepared}
		<p class="status" role="status">
			Prepared {prepared.width} × {prepared.height} · {Math.round(prepared.blob.size / 1024)} KB
		</p>
	{:else if notice}
		<p class="status" role="status">{notice}</p>
		<button
			class="text-action"
			data-testid="retry-preparation"
			type="button"
			onclick={retryPreparation}>Retry preparation</button
		>
	{:else if error}
		<p class="error-text" role="alert">{error}</p>
		<button
			class="text-action"
			data-testid="retry-preparation"
			type="button"
			onclick={retryPreparation}>Retry preparation</button
		>
	{/if}
	{#if prepared && notice}
		<p class="status" role="status">{notice}</p>
	{/if}
	{#if prepared && error}
		<p class="error-text" role="alert">{error}</p>
	{/if}

	<div class="actions">
		<button
			class="stamp wide"
			data-testid="save-png"
			type="button"
			disabled={!prepared}
			onclick={savePng}>Save PNG</button
		>
		<button class="ghost wide" type="button" disabled={!prepared} onclick={share}>Share…</button>
		<button class="text-action" type="button" disabled={!prepared} onclick={openImage}
			>Open image</button
		>
	</div>

	<div class="project">
		<span class="label">Editable project</span>
		<button class="ghost" data-testid="export-project" type="button" onclick={exportProject}
			>Export .remi</button
		>
		<p class="meta">Keeps every item, crop, and artwork for a full restore.</p>
	</div>
</dialog>

<style>
	.slip {
		border: 1px solid var(--ink);
		background: #faf7ee;
		color: var(--ink);
		padding: 20px 22px;
		width: 430px;
		max-width: calc(100vw - 24px);
		max-height: calc(100vh - 24px);
		overflow: auto;
		font-family: var(--sans);
	}
	.slip::backdrop {
		background: rgba(23, 21, 18, 0.38);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		font-size: 24px;
		letter-spacing: -0.02em;
		font-weight: 500;
		margin: 8px 0 2px;
	}
	.meta {
		margin: 0 0 14px;
	}
	.choice {
		display: flex;
		justify-content: space-between;
		width: 100%;
		background: transparent;
		border: 0;
		border-top: 1px solid var(--rule);
		padding: 11px 0;
		font-size: 13px;
		text-align: left;
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
		color: var(--spot);
		font-size: 11px;
		margin: 14px 0;
	}
	.status {
		font-size: 11px;
		color: var(--muted);
		margin: 10px 0;
	}
	.prep {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.prep-track {
		width: 100%;
		height: 2px;
		background: var(--rule);
		overflow: hidden;
	}
	.prep-track span {
		display: block;
		height: 2px;
		background: var(--ink);
		transition: width 0.15s linear;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 12px;
	}
	.wide {
		flex: 1;
		min-width: 120px;
	}
	.project {
		border-top: 1px solid var(--rule);
		margin-top: 18px;
		padding-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: flex-start;
	}
	.project .meta {
		margin: 0;
	}
	@media (max-width: 640px) {
		.choice {
			min-height: 44px;
			align-items: center;
		}
		.slip {
			width: 100%;
			max-width: none;
			margin: auto 0 0;
			padding: 18px 16px max(18px, env(safe-area-inset-bottom));
		}
	}
</style>
