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

	<p class="hint">
		<span class="pointer"
			>Drag a cell onto another to move or swap it, or select an item and use Move.</span
		>
		<span class="touch">Tap a cell, then use Move to place it in another slot.</span>
	</p>
</section>

<style>
	.panel-body {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.move-banner {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: center;
		background: var(--card);
		color: var(--ink);
		border-left: 3px solid var(--ink);
		padding: 10px 12px;
		font-size: 12px;
		line-height: 1.4;
	}
	.selected-block {
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 14px 0;
	}
	.selected-title {
		font-size: 14px;
		font-weight: 600;
		margin: 0 0 10px;
	}
	.row-actions {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
		align-items: center;
	}
	.slots {
		display: none;
		flex-direction: column;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 6px 0;
	}
	.slot {
		display: flex;
		gap: 10px;
		align-items: center;
		width: 100%;
		border: 0;
		background: transparent;
		padding: 3px 0;
		font-family: var(--sans);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-2);
		text-align: left;
		min-height: 28px;
	}
	.slot:not(:disabled):hover,
	.slot.selected {
		color: var(--ink);
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
	}
	.slot.selected .code {
		background: var(--action);
		color: var(--on-action);
	}
	.slot.empty .name {
		color: var(--ink-3);
	}
	.slot:disabled {
		opacity: 0.45;
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tray-block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.tray-head,
	.tray-row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: center;
	}
	.tray-head .section-title {
		margin: 0;
	}
	.tray-row .name {
		font-size: 13px;
		font-weight: 500;
		white-space: normal;
	}
	.hint {
		font-size: 12px;
		line-height: 1.5;
		color: var(--ink-2);
		margin: 0;
	}
	.touch {
		display: none;
	}
	@media (max-width: 900px) {
		/* The card is the slot picker on mobile; the 25-row list is redundant scroll. */
		.slots {
			display: none;
		}
		.touch {
			display: inline;
		}
		.pointer {
			display: none;
		}
	}
</style>
