<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { unplacedItems } from '#lib/card/document';
	import { FORMAT_SIZES } from '#lib/card/layout';
	import { createProjectArchive } from '#lib/card/archive';
	import { renderCardPng } from '#lib/card/png';
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
	let token = 0;
	let objectUrl: string | null = null;

	$effect(() => {
		const selected = resolution;
		const ticket = ++token;
		preparing = true;
		error = null;
		prepared = null;

		void (async () => {
			try {
				const rendered = await renderCardPng(snapshot, selected);
				if (ticket !== token) return;
				prepared = {
					blob: rendered.blob,
					width: rendered.layout.width,
					height: rendered.layout.height
				};
			} catch (failure) {
				if (ticket === token) {
					error = failure instanceof Error ? failure.message : String(failure);
				}
			} finally {
				if (ticket === token) preparing = false;
			}
		})();
	});

	onMount(() => {
		dialog?.showModal();
		return () => {
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	});

	onDestroy(() => {
		token += 1;
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
		objectUrl = URL.createObjectURL(prepared.blob);
		window.open(objectUrl, '_blank');
	}

	async function share() {
		if (!prepared) return;
		notice = null;
		const file = new File([prepared.blob], filename('png'), { type: 'image/png' });
		if (!navigator.canShare?.({ files: [file] })) {
			notice = 'Sharing files is unavailable here. Save the PNG instead.';
			return;
		}
		try {
			await navigator.share({ files: [file], title: snapshot.document.title });
		} catch (failure) {
			if (failure instanceof DOMException && failure.name === 'AbortError') return;
			error = failure instanceof Error ? failure.message : String(failure);
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
		<p class="status" role="status">Preparing {resolution === 2 ? '2×' : 'standard'} PNG…</p>
	{:else if prepared}
		<p class="status" role="status">
			Prepared {prepared.width} × {prepared.height} · {Math.round(prepared.blob.size / 1024)} KB
		</p>
	{/if}
	{#if error}<p class="error-text" role="alert">{error}</p>{/if}
	{#if notice}<p class="status" role="status">{notice}</p>{/if}

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
