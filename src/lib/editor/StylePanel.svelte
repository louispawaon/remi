<script lang="ts">
	import { FORMATS } from '#lib/card/types';
	import { normalizeArtwork } from '#lib/media/artwork';
	import type { EditorState } from './editor-state.svelte';

	let { editor }: { editor: EditorState } = $props();

	let replacing = $state(false);
	let imageError = $state<string | null>(null);
	let removeArmed = $state(false);

	$effect(() => {
		void editor.selectedItemId;
		removeArmed = false;
	});

	const crop = $derived(editor.selectedItem?.crops[editor.document.format] ?? { x: 0.5, y: 0.5 });

	async function replaceImage(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const itemId = editor.selectedItemId;
		if (!file || !itemId) return;
		replacing = true;
		imageError = null;
		try {
			const replaced = editor.replaceArtwork(itemId, await normalizeArtwork(file, file.type));
			if (!replaced) imageError = 'That item was removed while the image was loading.';
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

	<div class="field stacked face-field">
		<span>Face</span>
		<span class="seg face-seg">
			<button
				type="button"
				class="seg-btn"
				class:on={editor.document.appearance.font === 'sans'}
				aria-pressed={editor.document.appearance.font === 'sans'}
				onclick={() => editor.setAppearance({ font: 'sans' })}>Grotesque</button
			>
			<button
				type="button"
				class="seg-btn"
				class:on={editor.document.appearance.font === 'serif'}
				aria-pressed={editor.document.appearance.font === 'serif'}
				onclick={() => editor.setAppearance({ font: 'serif' })}>Serif</button
			>
			<button
				type="button"
				class="seg-btn"
				class:on={editor.document.appearance.font === 'display'}
				aria-pressed={editor.document.appearance.font === 'display'}
				onclick={() => editor.setAppearance({ font: 'display' })}>Display</button
			>
		</span>
	</div>

	<div class="field">
		<span>Ground</span>
		<span class="colors">
			<button
				type="button"
				class="swatch transparent"
				class:on={editor.document.appearance.background === 'transparent'}
				aria-pressed={editor.document.appearance.background === 'transparent'}
				aria-label="Transparent background"
				onclick={() => editor.setAppearance({ background: 'transparent' })}
			></button>
			{#each ['#0c0c0f', '#1b29ce', '#5a1a1a', '#f6ebc0'] as color (color)}
				<button
					type="button"
					class="swatch"
					class:on={editor.document.appearance.background === color}
					aria-pressed={editor.document.appearance.background === color}
					style={`background:${color}`}
					aria-label={`Background ${color}`}
					onclick={() => editor.setAppearance({ background: color })}
				></button>
			{/each}
			<input
				type="color"
				aria-label="Custom background colour"
				value={editor.document.appearance.background === 'transparent'
					? '#0c0c0f'
					: editor.document.appearance.background}
				oninput={(event) => editor.setAppearance({ background: event.currentTarget.value })}
			/>
		</span>
	</div>

	<div class="field">
		<span>Ink</span>
		<span class="colors">
			{#each ['#f6ebc0', '#ffffff', '#0c0c0f'] as color (color)}
				<button
					type="button"
					class="swatch"
					class:on={editor.document.appearance.foreground === color}
					aria-pressed={editor.document.appearance.foreground === color}
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
					oninput={(event) => {
						editor.setItemTitle(event.currentTarget.value);
						const accepted = editor.selectedItem?.titleOverride ?? '';
						if (editor.editError && event.currentTarget.value !== accepted) {
							event.currentTarget.value = accepted;
						}
					}}
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
			{/if}

			<label class="ghost file-label">
				{replacing ? 'Reading image…' : editor.selectedItem.artwork ? 'Replace image' : 'Add image'}
				<input
					class="visually-hidden"
					type="file"
					accept="image/png,image/jpeg,image/webp"
					onchange={replaceImage}
					disabled={replacing}
				/>
			</label>
			{#if imageError}<p class="error-text" role="alert">{imageError}</p>{/if}

			<div class="row-actions">
				<button
					class="ghost"
					type="button"
					onclick={() => editor.beginMove(editor.selectedItem!.id)}
				>
					Move
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
		</section>
	{:else}
		<p class="hint">Select a cell or an unplaced item to edit its caption, crop, or image.</p>
	{/if}
</section>

<style>
	.panel-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.colors {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.swatch {
		width: 26px;
		height: 26px;
		border: 1.5px solid var(--ink);
		border-radius: 50%;
		padding: 0;
	}
	.swatch.transparent {
		background-color: var(--ink);
		background-image:
			linear-gradient(
				45deg,
				var(--ground) 25%,
				transparent 25%,
				transparent 75%,
				var(--ground) 75%
			),
			linear-gradient(45deg, var(--ground) 25%, transparent 25%, transparent 75%, var(--ground) 75%);
		background-size: 8px 8px;
		background-position:
			0 0,
			4px 4px;
	}
	.swatch.on {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
	.colors input[type='color'] {
		width: 30px;
		height: 30px;
	}
	.item-block {
		border-top: 1px solid var(--rule);
		padding-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.item-block .section-title {
		margin: 0;
	}
	.full-title {
		margin: 0;
		font-size: 12px;
		line-height: 1.4;
		color: var(--ink-2);
	}
	.face-seg {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.face-seg .seg-btn {
		padding: 0 4px;
	}
	.crop {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.crop-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.crop-row {
		display: grid;
		grid-template-columns: 84px 1fr;
		gap: 10px;
		align-items: center;
		font-size: 12px;
		font-weight: 500;
	}
	.crop-row input[type='range'] {
		width: 100%;
	}
	.row-actions {
		display: flex;
		gap: 14px;
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
		font-size: 12px;
		line-height: 1.5;
		color: var(--ink-2);
		margin: 0;
	}
	@media (max-width: 900px) {
		.swatch {
			width: 38px;
			height: 38px;
		}
		.colors input[type='color'] {
			width: 44px;
			height: 44px;
		}
		.crop-row input[type='range'] {
			height: 44px;
		}
	}
</style>
