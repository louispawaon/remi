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
	let dragOffset = $state(0);
	let dragging = $state(false);
	let dragStartY = 0;

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
		const html = document.documentElement;
		const body = document.body;
		const previous = { html: html.style.overflow, body: body.style.overflow };
		// Native dialogs leave the page scrollable behind the mobile sheet.
		if (window.matchMedia('(max-width: 640px)').matches) {
			html.style.overflow = 'hidden';
			body.style.overflow = 'hidden';
		}
		return () => {
			html.style.overflow = previous.html;
			body.style.overflow = previous.body;
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

	function startDrag(event: PointerEvent) {
		if (event.pointerType === 'mouse') return;
		dragging = true;
		dragStartY = event.clientY;
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// The pointer can already be gone on a fast fling; the gesture still works.
		}
	}

	function moveDrag(event: PointerEvent) {
		if (!dragging) return;
		dragOffset = Math.max(0, event.clientY - dragStartY);
	}

	function endDrag() {
		if (!dragging) return;
		dragging = false;
		if (dragOffset > 90) onClose();
		else dragOffset = 0;
	}

	function backdropClose(event: MouseEvent) {
		// Keyboard activation reports no pointer detail; never treat it as an outside tap.
		if (event.detail === 0 || !dialog) return;
		const rect = dialog.getBoundingClientRect();
		const inside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!inside) onClose();
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
	class:dragging
	style={`transform: translateY(${dragOffset}px)`}
	aria-labelledby="export-title"
	onclick={backdropClose}
	oncancel={(event) => {
		event.preventDefault();
		onClose();
	}}
>
	<div
		class="handle"
		aria-hidden="true"
		onpointerdown={startDrag}
		onpointermove={moveDrag}
		onpointerup={endDrag}
		onpointercancel={endDrag}
	>
		<span class="grabber"></span>
	</div>
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
	</div>
	<button class="text-action open-row" type="button" disabled={!prepared} onclick={openImage}
		>Open image</button
	>

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
		border: 0;
		border-radius: 0;
		background: var(--ink);
		color: var(--ground);
		padding: 24px;
		width: 440px;
		max-width: calc(100vw - 24px);
		max-height: calc(100vh - 24px);
		overflow: auto;
		overscroll-behavior: contain;
		font-family: var(--sans);
		box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.55);
		transition: transform 0.18s ease;
	}
	.slip.dragging {
		transition: none;
	}
	.slip::backdrop {
		background: rgba(7, 9, 38, 0.66);
	}
	.handle,
	.grabber {
		display: none;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}
	.head .label {
		color: var(--ground);
		opacity: 0.7;
	}
	.slip h2 {
		font-family: var(--display);
		font-size: 32px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.035em;
		line-height: 0.94;
		margin: 14px 0 6px;
	}
	.meta {
		margin: 0 0 18px;
		color: var(--ground);
		opacity: 0.68;
	}
	.choice {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		background: transparent;
		border: 0;
		border-top: 1px solid color-mix(in srgb, var(--ground) 22%, transparent);
		padding: 13px 0;
		font-size: 14px;
		font-weight: 600;
		text-align: left;
		color: var(--ground);
	}
	.choice .mono {
		color: var(--ground);
		opacity: 0.6;
	}
	.choice.on {
		font-weight: 800;
	}
	.choice.on span:first-child::before {
		content: '● ';
		font-size: 10px;
	}
	.choice:not(.on) span:first-child::before {
		content: '○ ';
		font-size: 10px;
		opacity: 0.5;
	}
	.warn {
		color: var(--ground);
		font-size: 12px;
		font-weight: 600;
		line-height: 1.45;
		margin: 16px 0;
		border-left: 3px solid var(--ground);
		padding-left: 10px;
	}
	.status {
		font-size: 12px;
		font-weight: 500;
		color: var(--ground);
		opacity: 0.68;
		margin: 12px 0;
	}
	.prep {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
	}
	.prep-track {
		width: 100%;
		height: 3px;
		background: color-mix(in srgb, var(--ground) 18%, transparent);
		overflow: hidden;
	}
	.prep-track span {
		display: block;
		height: 3px;
		background: var(--ground);
		transition: width 0.15s linear;
	}
	.open-row {
		margin-top: 10px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		margin-top: 16px;
	}
	.wide {
		flex: 1;
		min-width: 130px;
	}
	.slip .stamp {
		background: var(--ground);
		color: var(--ink);
		box-shadow: 3px 3px 0 #0c0c0f;
	}
	.slip .stamp:hover:not(:disabled) {
		box-shadow: 4px 4px 0 #0c0c0f;
	}
	.slip .ghost {
		border-color: var(--ground);
		color: var(--ground);
	}
	.slip .ghost:hover:not(:disabled) {
		background: var(--ground);
		color: var(--ink);
	}
	.slip .text-action {
		color: var(--ground);
		text-decoration-color: color-mix(in srgb, var(--ground) 40%, transparent);
	}
	.slip .text-action:hover:not(:disabled) {
		text-decoration-color: var(--ground);
	}
	.project {
		border-top: 1px solid color-mix(in srgb, var(--ground) 22%, transparent);
		margin-top: 22px;
		padding-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
	}
	.project .label {
		color: var(--ground);
		opacity: 0.6;
	}
	.project .meta {
		margin: 0;
		color: var(--ground);
		opacity: 0.6;
	}
	@media (max-width: 640px) {
		.handle {
			display: block;
			margin: -14px -16px 10px;
			padding: 10px 0 12px;
			touch-action: none;
			cursor: grab;
		}
		.grabber {
			display: block;
			width: 36px;
			height: 5px;
			border-radius: 999px;
			background: color-mix(in srgb, var(--ground) 38%, transparent);
			margin: 0 auto;
		}
		.slip {
			width: 100%;
			max-width: none;
			max-height: 88dvh;
			border-radius: 28px 28px 0 0;
			margin: auto 0 0;
			padding: 14px 16px max(20px, env(safe-area-inset-bottom));
			box-shadow: 0 -6px 0 rgba(0, 0, 0, 0.35);
		}
		.choice {
			min-height: 44px;
			padding: 8px 0;
		}
	}
</style>
