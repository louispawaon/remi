<script lang="ts">
	import { isFreeSpaceCell } from '#lib/card/document';
	import type { EditorState } from './editor-state.svelte';

	let { editor }: { editor: EditorState } = $props();
</script>

<aside class="sheet-map" aria-label="Slots">
	<div class="map-head">
		<h2 class="section-title">Sheet map</h2>
		<span class="mono">{editor.document.gridSize}×{editor.document.gridSize}</span>
	</div>

	<div class="rows">
		{#each editor.document.slots as slot, index (index)}
			{@const item = slot
				? editor.document.items.find((candidate) => candidate.id === slot)
				: undefined}
			<button
				type="button"
				class="row"
				class:selected={editor.selectedSlot === index}
				class:empty={!item}
				aria-pressed={editor.selectedSlot === index}
				onclick={() => editor.selectSlot(index)}
				disabled={isFreeSpaceCell(editor.document, index)}
			>
				<span class="code">{String(index + 1).padStart(2, '0')}</span>
				<span class="name">
					{#if isFreeSpaceCell(editor.document, index)}
						Free space
					{:else if item}
						{item.titleOverride ?? item.titles.preferred}
					{:else}
						— blank —
					{/if}
				</span>
			</button>
		{/each}
	</div>

	<div class="map-foot">
		<span class="mono">{editor.unplaced.length} unplaced</span>
		<span class="mono" data-testid="item-count">{editor.document.items.length} items</span>
	</div>
</aside>

<style>
	.sheet-map {
		border-left: 1px solid var(--rule);
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.map-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.map-head .section-title {
		margin: 0;
	}
	.rows {
		overflow: auto;
		min-height: 0;
		margin-top: 8px;
	}
	.row {
		display: flex;
		gap: 10px;
		align-items: center;
		width: 100%;
		border: 0;
		background: transparent;
		padding: 3px 0;
		font-family: var(--sans);
		font-size: 12px;
		font-weight: 500;
		text-align: left;
		color: var(--ink-2);
		min-height: 26px;
	}
	.row:not(:disabled):hover {
		color: var(--ink);
	}
	.row.selected {
		color: var(--ink);
	}
	.row.selected .code {
		background: var(--action);
		color: var(--on-action);
	}
	.row:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.code {
		width: 26px;
		height: 20px;
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.map-foot {
		display: flex;
		justify-content: space-between;
		border-top: 1px solid var(--rule);
		padding-top: 10px;
		margin-top: 10px;
	}
	@media (max-width: 900px) {
		.row {
			min-height: 40px;
		}
	}
</style>
