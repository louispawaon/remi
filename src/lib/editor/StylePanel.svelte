<script lang="ts">
	import { FORMATS } from '#lib/card/types';
	import { normalizeArtwork } from '#lib/media/artwork';
	import type { EditorState } from './editor-state.svelte';

	let { editor }: { editor: EditorState } = $props();

	let replacing = $state(false);
	let imageError = $state<string | null>(null);

	const crop = $derived(editor.selectedItem?.crops[editor.document.format] ?? { x: 0.5, y: 0.5 });

	async function replaceImage(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		replacing = true;
		imageError = null;
		try {
			editor.replaceSelectedArtwork(await normalizeArtwork(file, file.type));
		} catch (error) {
			imageError = error instanceof Error ? error.message : String(error);
		} finally {
			replacing = false;
			input.value = '';
		}
	}
</script>

<section class="panel-body" aria-label="Style">
	<h2 class="section-title">Style</h2>

	<div class="field">
		<span>Titles</span>
		<button
			type="button"
			class="switch"
			role="switch"
			aria-checked={editor.document.appearance.titleVisible}
			aria-label="Show titles"
			onclick={() =>
				editor.setAppearance({ titleVisible: !editor.document.appearance.titleVisible })}
		></button>
	</div>

	<div class="field">
		<span>Format</span>
		<span class="seg">
			{#each FORMATS as format (format)}
				<button
					type="button"
					class="seg-btn"
					class:on={editor.document.format === format}
					aria-pressed={editor.document.format === format}
					onclick={() => editor.setFormat(format)}>{format}</button
				>
			{/each}
		</span>
	</div>

	<div class="field">
		<span>Face</span>
		<span class="seg">
			<button
				type="button"
				class="seg-btn"
				class:on={editor.document.appearance.font === 'sans'}
				onclick={() => editor.setAppearance({ font: 'sans' })}>Grotesque</button
			>
			<button
				type="button"
				class="seg-btn"
				class:on={editor.document.appearance.font === 'serif'}
				onclick={() => editor.setAppearance({ font: 'serif' })}>Serif</button
			>
			<button
				type="button"
				class="seg-btn"
				class:on={editor.document.appearance.font === 'display'}
				onclick={() => editor.setAppearance({ font: 'display' })}>Display</button
			>
		</span>
	</div>

	<div class="field">
		<span>Ground</span>
		<span class="colors">
			{#each ['#12100e', '#22402f', '#7a2e2a', '#e7dcc3'] as color (color)}
				<button
					type="button"
					class="swatch"
					class:on={editor.document.appearance.background === color}
					style={`background:${color}`}
					aria-label={`Background ${color}`}
					onclick={() => editor.setAppearance({ background: color })}
				></button>
			{/each}
			<input
				type="color"
				aria-label="Custom background colour"
				value={editor.document.appearance.background}
				oninput={(event) => editor.setAppearance({ background: event.currentTarget.value })}
			/>
		</span>
	</div>

	<div class="field">
		<span>Ink</span>
		<span class="colors">
			{#each ['#f4efe6', '#ffffff', '#171512'] as color (color)}
				<button
					type="button"
					class="swatch"
					class:on={editor.document.appearance.foreground === color}
					style={`background:${color}`}
					aria-label={`Foreground ${color}`}
					onclick={() => editor.setAppearance({ foreground: color })}
				></button>
			{/each}
			<input
				type="color"
				aria-label="Custom text colour"
				value={editor.document.appearance.foreground}
				oninput={(event) => editor.setAppearance({ foreground: event.currentTarget.value })}
			/>
		</span>
	</div>

	{#if editor.selectedItem}
		<section class="item-block" aria-label="Selected item">
			<p class="section-title">Selected item</p>
			<label class="field stacked">
				<span>Caption</span>
				<input
					class="input"
					type="text"
					value={editor.selectedItem.titleOverride ?? ''}
					placeholder={editor.selectedItem.titles.preferred}
					oninput={(event) => editor.setItemTitle(event.currentTarget.value)}
				/>
			</label>
			<p class="full-title">{editor.selectedItem.titles.preferred}</p>

			{#if editor.selectedItem.artwork}
				<div class="crop">
					<div class="crop-head">
						<span class="label">Crop · {editor.document.format}</span>
						<button class="text-action" type="button" onclick={() => editor.centerCrop()}
							>Center</button
						>
					</div>
					<label class="crop-row">
						<span>Horizontal</span>
						<input
							type="range"
							min="0"
							max="100"
							step="1"
							aria-label="Crop horizontal position"
							value={Math.round(crop.x * 100)}
							oninput={(event) => editor.setCrop(Number(event.currentTarget.value) / 100, crop.y)}
						/>
					</label>
					<label class="crop-row">
						<span>Vertical</span>
						<input
							type="range"
							min="0"
							max="100"
							step="1"
							aria-label="Crop vertical position"
							value={Math.round(crop.y * 100)}
							oninput={(event) => editor.setCrop(crop.x, Number(event.currentTarget.value) / 100)}
						/>
					</label>
					<p class="hint">Crops are saved per format.</p>
				</div>

				<label class="ghost file-label">
					{replacing ? 'Reading image…' : 'Replace image'}
					<input
						class="visually-hidden"
						type="file"
						accept="image/png,image/jpeg,image/webp"
						onchange={replaceImage}
						disabled={replacing}
					/>
				</label>
				{#if imageError}<p class="error-text" role="alert">{imageError}</p>{/if}
			{/if}

			<div class="row-actions">
				<button
					class="ghost"
					type="button"
					onclick={() => editor.beginMove(editor.selectedItem!.id)}
				>
					Move
				</button>
				<button class="text-action" type="button" onclick={() => editor.removeSelectedItem()}>
					Remove item
				</button>
			</div>
		</section>
	{:else}
		<p class="hint">Select a cell or an unplaced item to edit its caption, crop, or image.</p>
	{/if}
</section>

<style>
	.panel-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.colors {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.swatch {
		width: 20px;
		height: 20px;
		border: 1px solid var(--ink);
		padding: 0;
	}
	.swatch.on {
		outline: 1px solid var(--spot);
		outline-offset: 2px;
	}
	.colors input[type='color'] {
		width: 26px;
		height: 24px;
		padding: 0;
		border: 1px solid var(--rule);
		background: transparent;
	}
	.item-block {
		border-top: 1px solid var(--rule);
		padding-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.field.stacked {
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
	}
	.full-title {
		margin: 0;
		font-size: 11px;
		line-height: 1.4;
		color: var(--muted);
	}
	.crop {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.crop-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.crop-row {
		display: grid;
		grid-template-columns: 82px 1fr;
		gap: 8px;
		align-items: center;
		font-size: 11px;
	}
	.crop-row input[type='range'] {
		width: 100%;
		accent-color: var(--spot);
	}
	.row-actions {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}
	.file-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.hint {
		font-size: 10px;
		line-height: 1.5;
		color: var(--muted);
		margin: 0;
	}
</style>
