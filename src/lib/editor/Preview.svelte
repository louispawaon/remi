<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { CardLayout, Rect } from '#lib/card/layout';
	import { renderCard } from '#lib/card/png';
	import type { EditorState } from './editor-state.svelte';

	let { editor }: { editor: EditorState } = $props();

	let host = $state<HTMLDivElement>();
	let layout = $state<CardLayout | null>(null);
	let renderError = $state<string | null>(null);
	let token = 0;

	$effect(() => {
		const snapshot = editor.record;
		const ticket = ++token;

		if (!host) return;
		void (async () => {
			try {
				const rendered = await renderCard(snapshot, 1);
				if (ticket !== token) return;
				const canvas = rendered.canvas;
				canvas.style.width = '100%';
				canvas.style.height = 'auto';
				canvas.style.display = 'block';
				// eslint-disable-next-line svelte/no-dom-manipulating -- the canvas is the preview surface
				host.replaceChildren(canvas);
				layout = rendered.layout;
				renderError = null;
			} catch (error) {
				if (ticket === token) {
					renderError = error instanceof Error ? error.message : String(error);
				}
			}
		})();
	});

	onDestroy(() => {
		token += 1;
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
</script>

<div class="preview-frame">
	<div
		class="plate"
		class:actual={editor.zoom === 'actual'}
		style={layout ? `aspect-ratio:${layout.width} / ${layout.height}` : undefined}
	>
		<div bind:this={host} class="canvas-host"></div>

		{#if layout}
			<div class="cells">
				{#each layout.cells as cell, index (index)}
					{@const free = index === layout.freeCellIndex}
					<button
						type="button"
						class="cell"
						class:selected={editor.selectedSlot === index}
						class:target={Boolean(editor.movingItemId) && !free}
						class:free
						style={cellStyle(cell, layout)}
						disabled={free}
						aria-label={label(index)}
						aria-pressed={editor.selectedSlot === index}
						onclick={() => editor.selectSlot(index)}
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
			<span class="mono">SELECTED</span>
			{editor.selectedItem?.titleOverride ?? editor.selectedItem?.titles.preferred}
		</p>
	{:else}
		<p class="selected-note"><span class="mono">SELECTED</span> none</p>
	{/if}
</div>

<style>
	.preview-frame {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		overflow: auto;
	}
	.plate {
		position: relative;
		width: 100%;
		max-width: 540px;
		margin: 0 auto;
		border: 1px solid var(--ink);
		background: #0d0c0b;
	}
	.plate.actual {
		width: 1080px;
		max-width: none;
	}
	.canvas-host {
		width: 100%;
		line-height: 0;
	}
	.cells {
		position: absolute;
		inset: 0;
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
	.cell:focus-visible {
		outline: 3px solid var(--spot);
		outline-offset: -4px;
	}
	.cell.selected {
		box-shadow: inset 0 0 0 2px var(--spot);
	}
	.cell.target:not(.free) {
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.cell-code {
		position: absolute;
		top: 0;
		left: 0;
		background: var(--spot);
		color: #fff;
		font-family: var(--mono);
		font-size: 9px;
		padding: 2px 4px;
		line-height: 1.2;
	}
	.selected-note {
		margin: 0;
		text-align: center;
		font-size: 12px;
		color: var(--muted);
		min-height: 18px;
	}
	.render-error {
		padding: 12px;
		background: var(--paper);
	}
</style>
