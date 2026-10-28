<script lang="ts">
	import { isFreeSpaceCell } from '#lib/card/document';
	import type { EditorState } from './editor-state.svelte';

	let { editor }: { editor: EditorState } = $props();
</script>

<aside class="sheet-map" aria-label="Sheet map">
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
				onclick={() => editor.selectSlot(index)}
				disabled={isFreeSpaceCell(editor.document, index)}
			>
				<span class="code">{String(index + 1).padStart(2, '0')}</span>
				<span class="name">
					{#if isFreeSpaceCell(editor.document, index)}
						FREE
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
		<span class="mono">{editor.document.items.length} items</span>
	</div>
</aside>

<style>
	.sheet-map {
		border-left: 1px solid var(--rule);
		padding: 16px 14px;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.map-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.rows {
		overflow: auto;
		min-height: 0;
	}
	.row {
		display: flex;
		gap: 8px;
		width: 100%;
		border: 0;
		background: transparent;
		padding: 2px 0;
		font-family: var(--mono);
		font-size: 9px;
		text-align: left;
		color: var(--muted);
	}
	.row:not(:disabled):hover {
		color: var(--ink);
	}
	.row.selected {
		color: var(--ink);
	}
	.row.selected .code {
		color: var(--spot);
	}
	.row:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.code {
		width: 18px;
		flex: none;
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
		padding-top: 8px;
		margin-top: 8px;
	}
</style>
