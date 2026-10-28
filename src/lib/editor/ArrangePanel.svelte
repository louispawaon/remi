<script lang="ts">
	import { isFreeSpaceCell } from '#lib/card/document';
	import { GRID_SIZES } from '#lib/card/types';
	import type { EditorState } from './editor-state.svelte';

	let { editor }: { editor: EditorState } = $props();

	let removeArmed = $state(false);

	$effect(() => {
		void editor.selectedItemId;
		removeArmed = false;
	});

	function title(id: string | null) {
		const item = id ? editor.document.items.find((candidate) => candidate.id === id) : undefined;
		return item ? (item.titleOverride ?? item.titles.preferred) : '— blank —';
	}
</script>

<section class="panel-body" aria-label="Arrange">
	<h2 class="section-title">Arrange</h2>

	{#if editor.movingItem}
		<div class="move-banner" role="status">
			<span>
				Placing <strong
					>{editor.movingItem.titleOverride ?? editor.movingItem.titles.preferred}</strong
				>. Choose a cell.
			</span>
			<button class="text-action" type="button" onclick={() => editor.cancelMove()}>Cancel</button>
		</div>
	{/if}

	<div class="field">
		<span>Grid</span>
		<span class="seg">
			{#each GRID_SIZES as size (size)}
				<button
					type="button"
					class="seg-btn"
					class:on={editor.document.gridSize === size}
					aria-pressed={editor.document.gridSize === size}
					onclick={() => editor.setGridSize(size)}>{size}</button
				>
			{/each}
		</span>
	</div>

	<div class="field">
		<span>Free space</span>
		<button
			type="button"
			class="switch"
			role="switch"
			aria-checked={editor.document.freeSpace && editor.document.gridSize % 2 === 1}
			aria-label="Central free space"
			disabled={editor.document.gridSize % 2 === 0}
			onclick={() => editor.setFreeSpace(!editor.document.freeSpace)}
		></button>
	</div>
	{#if editor.document.gridSize % 2 === 0}
		<p class="hint">Free space is available on odd grids.</p>
	{/if}

	<div class="field">
		<span>Shuffle</span>
		<button class="ghost" type="button" onclick={() => editor.shuffle()}>Shuffle placed</button>
	</div>

	{#if editor.selectedItem}
		<div class="selected-block">
			<p class="section-title">Selected</p>
			<p class="selected-title">
				{editor.selectedItem.titleOverride ?? editor.selectedItem.titles.preferred}
			</p>
			<div class="row-actions">
				<button
					class="ghost"
					type="button"
					onclick={() => editor.beginMove(editor.selectedItem!.id)}
				>
					Move
				</button>
				<button class="ghost" type="button" onclick={() => editor.unplace(editor.selectedItem!.id)}>
					To tray
				</button>
				{#if removeArmed}
					<button
						class="text-action"
						type="button"
						onclick={() => {
							editor.removeSelectedItem();
							removeArmed = false;
						}}>Confirm remove</button
					>
					<button class="text-action" type="button" onclick={() => (removeArmed = false)}
						>Keep</button
					>
				{:else}
					<button class="text-action" type="button" onclick={() => (removeArmed = true)}
						>Remove item</button
					>
				{/if}
			</div>
		</div>
	{/if}

	<div class="slots" aria-label="Slots">
		{#each editor.document.slots as slot, index (index)}
			<button
				type="button"
				class="slot"
				class:selected={editor.selectedSlot === index}
				class:empty={!slot}
				aria-pressed={editor.selectedSlot === index}
				disabled={isFreeSpaceCell(editor.document, index)}
				onclick={() => editor.selectSlot(index)}
			>
				<span class="code">{String(index + 1).padStart(2, '0')}</span>
				<span class="name">
					{#if isFreeSpaceCell(editor.document, index)}
						FREE
					{:else}
						{title(slot)}
					{/if}
				</span>
			</button>
		{/each}
	</div>

	<div class="tray-block">
		<div class="tray-head">
			<span class="section-title">Unplaced · {String(editor.unplaced.length).padStart(2, '0')}</span
			>
			<span class="mono">Excluded from PNG</span>
		</div>
		{#if editor.unplaced.length === 0}
			<p class="hint">Nothing is waiting.</p>
		{:else}
			{#each editor.unplaced as item (item.id)}
				<div class="tray-row">
					<span class="name">{item.titleOverride ?? item.titles.preferred}</span>
					<span class="row-actions">
						<button class="text-action" type="button" onclick={() => editor.beginMove(item.id)}
							>Place</button
						>
						<button class="text-action" type="button" onclick={() => editor.removeItem(item.id)}
							>Remove</button
						>
					</span>
				</div>
			{/each}
		{/if}
	</div>

	<p class="hint">Select a slot, then a cell. No dragging.</p>
</section>

<style>
	.panel-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.move-banner {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: center;
		border: 1px solid var(--spot);
		padding: 8px 10px;
		font-size: 12px;
	}
	.selected-block {
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 10px 0;
	}
	.selected-title {
		font-size: 13px;
		margin: 0 0 6px;
	}
	.row-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}
	.slots {
		display: flex;
		flex-direction: column;
		max-height: 280px;
		overflow: auto;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 4px 0;
	}
	.slot {
		display: flex;
		gap: 8px;
		width: 100%;
		border: 0;
		background: transparent;
		padding: 3px 0;
		font-family: var(--mono);
		font-size: 9px;
		color: var(--muted);
		text-align: left;
	}
	.slot:not(:disabled):hover,
	.slot.selected {
		color: var(--ink);
	}
	.slot.selected .code {
		color: var(--spot);
	}
	.slot.empty .name {
		color: var(--rule);
	}
	.slot:disabled {
		opacity: 0.5;
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
	.tray-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.tray-head,
	.tray-row {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: center;
	}
	.tray-row .name {
		font-size: 12px;
		white-space: normal;
	}
	@media (max-width: 900px) {
		.slot {
			min-height: 44px;
			padding: 8px 0;
		}
	}
	.hint {
		font-size: 10px;
		line-height: 1.5;
		color: var(--muted);
		margin: 0;
	}
</style>
