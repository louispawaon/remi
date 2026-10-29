<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { CardLayout, Rect } from '#lib/card/layout';
	import { renderCard } from '#lib/card/png';
	import type { EditorState } from './editor-state.svelte';

	let { editor, compact = false }: { editor: EditorState; compact?: boolean } = $props();

	let host = $state<HTMLDivElement>();
	let layout = $state<CardLayout | null>(null);
	let renderError = $state<string | null>(null);
	let overIndex = $state<number | null>(null);
	let hang = $state(false);
	let hangTimer: ReturnType<typeof setTimeout> | null = null;
	let lastFilled: number | null = null;
	let token = 0;

	$effect(() => {
		const snapshot = editor.record;
		const ticket = ++token;

		if (!host) return;
		const target = host;
		const timer = setTimeout(() => {
			if (ticket !== token) return;
			void (async () => {
				try {
					const rendered = await renderCard(snapshot, 1);
					if (ticket !== token) return;
					const canvas = rendered.canvas;
					canvas.style.width = '100%';
					canvas.style.height = 'auto';
					canvas.style.display = 'block';
					target.replaceChildren(canvas);
					layout = rendered.layout;
					renderError = null;
				} catch (error) {
					if (ticket === token) {
						renderError = error instanceof Error ? error.message : String(error);
					}
				}
			})();
		}, 120);

		return () => {
			clearTimeout(timer);
			token += 1;
		};
	});

	$effect(() => {
		const filled = editor.document.slots.filter(Boolean).length;
		if (lastFilled !== null && filled > lastFilled) press();
		lastFilled = filled;
	});

	function press() {
		hang = false;
		if (hangTimer) clearTimeout(hangTimer);
		void Promise.resolve().then(() => (hang = true));
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
		hangTimer = setTimeout(() => {
			hang = false;
			hangTimer = null;
		}, 300);
	}

	onDestroy(() => {
		token += 1;
		if (hangTimer) clearTimeout(hangTimer);
	});

	function cellStyle(cell: Rect, current: CardLayout): string {
		return [
			`left:${(cell.x / current.width) * 100}%`,
			`top:${(cell.y / current.height) * 100}%`,
			`width:${(cell.width / current.width) * 100}%`,
			`height:${(cell.height / current.height) * 100}%`
		].join(';');
	}

	function label(index: number): string {
		const number = String(index + 1).padStart(2, '0');
		if (layout && index === layout.freeCellIndex) return `Slot ${number}: free space`;
		const id = editor.document.slots[index];
		if (!id) return `Slot ${number}: empty`;
		const item = editor.document.items.find((candidate) => candidate.id === id);
		return `Slot ${number}: ${item ? (item.titleOverride ?? item.titles.preferred) : 'unknown item'}`;
	}

	function startDrag(event: DragEvent, index: number): void {
		const itemId = editor.document.slots[index];
		if (!itemId) {
			event.preventDefault();
			return;
		}
		event.dataTransfer?.setData('text/plain', itemId);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
		editor.beginMove(itemId);
		overIndex = null;
	}

	function overCell(event: DragEvent, index: number): void {
		if (!editor.movingItemId) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		overIndex = index;
	}

	function leaveCell(index: number): void {
		if (overIndex === index) overIndex = null;
	}

	function dropOnCell(event: DragEvent, index: number): void {
		event.preventDefault();
		editor.placeMovingItem(index);
		overIndex = null;
	}

	function endDrag(): void {
		overIndex = null;
		editor.cancelMove();
	}
</script>

<div class="preview-frame" class:compact>
	<div
		class="plate"
		class:hang
		class:actual={editor.zoom === 'actual'}
		style={layout ? `aspect-ratio:${layout.width} / ${layout.height}` : undefined}
	>
		<div bind:this={host} class="canvas-host"></div>
		<span class="wash" aria-hidden="true"></span>

		{#if layout}
			<div class="cells">
				{#each layout.cells as cell, index (index)}
					{@const free = index === layout.freeCellIndex}
					{@const occupied = Boolean(editor.document.slots[index])}
					<button
						type="button"
						class="cell"
						class:selected={editor.selectedSlot === index}
						class:target={Boolean(editor.movingItemId) && !free}
						class:over={overIndex === index}
						class:dragging={Boolean(editor.movingItemId) &&
							editor.document.slots[index] === editor.movingItemId}
						class:free
						style={cellStyle(cell, layout)}
						disabled={free}
						draggable={occupied}
						aria-label={label(index)}
						aria-pressed={editor.selectedSlot === index}
						onclick={() => editor.selectSlot(index)}
						ondragstart={(event) => startDrag(event, index)}
						ondragend={endDrag}
						ondragover={(event) => overCell(event, index)}
						ondragleave={() => leaveCell(index)}
						ondrop={(event) => dropOnCell(event, index)}
					>
						{#if editor.selectedSlot === index && !free}
							<span class="cell-code">{String(index + 1).padStart(2, '0')}</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		{#if renderError}
			<p class="render-error error-text" role="alert">{renderError}</p>
		{/if}
	</div>

	{#if editor.selectedItemId}
		<p class="selected-note">
			<span class="mono">Selected</span>
			{editor.selectedItem?.titleOverride ?? editor.selectedItem?.titles.preferred}
		</p>
	{:else}
		<p class="selected-note"><span class="mono">Selected</span> none</p>
	{/if}
</div>

<style>
	.preview-frame {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
		overflow: auto;
	}
	.plate {
		position: relative;
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
		background: var(--card);
		border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);
		box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.55);
	}
	.plate.actual {
		width: 1080px;
		max-width: none;
	}
	.plate.hang {
		animation: hang 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.plate.hang .wash {
		animation: wash 220ms ease-out;
	}
	.canvas-host {
		width: 100%;
		line-height: 0;
	}
	.wash {
		position: absolute;
		inset: 0;
		background: var(--ink);
		opacity: 0;
		pointer-events: none;
		z-index: 2;
	}
	.cells {
		position: absolute;
		inset: 0;
		z-index: 1;
	}
	.cell {
		position: absolute;
		background: transparent;
		border: 0;
		padding: 0;
		min-width: 0;
		min-height: 0;
	}
	.cell:not(:disabled) {
		cursor: pointer;
	}
	.cell[draggable='true'] {
		cursor: grab;
	}
	.cell[draggable='true']:active {
		cursor: grabbing;
	}
	.cell.dragging {
		opacity: 0.35;
	}
	.cell:focus-visible {
		outline: 3px solid var(--ink);
		outline-offset: -4px;
	}
	.cell.selected {
		box-shadow: inset 0 0 0 2px var(--ink);
	}
	.cell.target {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 35%, transparent);
	}
	.cell.over {
		box-shadow: inset 0 0 0 3px var(--ink);
		background: color-mix(in srgb, var(--ink) 14%, transparent);
	}
	.cell-code {
		position: absolute;
		top: 6px;
		left: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 7px;
		background: var(--action);
		color: var(--on-action);
		font-family: var(--sans);
		font-size: 10px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.06em;
		border-radius: 999px;
		animation: stamp 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.selected-note {
		margin: 0;
		text-align: center;
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-2);
		min-height: 18px;
	}
	.selected-note .mono {
		margin-right: 8px;
	}
	.render-error {
		padding: 12px;
		background: var(--card);
	}
	@keyframes hang {
		0% {
			transform: scale(1);
		}
		22% {
			transform: scale(0.982);
		}
		55% {
			transform: scale(1.004);
		}
		100% {
			transform: scale(1);
		}
	}
	@keyframes wash {
		0% {
			opacity: 0.16;
		}
		100% {
			opacity: 0;
		}
	}
	@keyframes stamp {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		65% {
			transform: scale(1.12);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}
	@media (max-width: 900px) {
		.preview-frame.compact {
			max-width: 200px;
			margin: 0 auto;
		}
		.preview-frame.compact .selected-note {
			display: none;
		}
		.preview-frame.compact .plate {
			box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.55);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.plate.hang {
			animation: none;
		}
		.plate.hang .wash {
			animation: none;
		}
		.cell-code {
			animation: none;
		}
	}
</style>
