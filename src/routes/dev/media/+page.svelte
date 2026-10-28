<script lang="ts">
	import { onMount } from 'svelte';
	import { normalizeArtwork } from '#lib/media/artwork';
	import type { MediaHarnessApi } from '#lib/dev/media-api';

	let status = $state('Ready');
	let preview = $state<string | null>(null);

	async function createPng(width: number, height: number): Promise<number[]> {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas 2D is unavailable');

		const gradient = context.createLinearGradient(0, 0, width, height);
		gradient.addColorStop(0, '#b8452f');
		gradient.addColorStop(1, '#2f6bb8');
		context.fillStyle = gradient;
		context.fillRect(0, 0, width, height);
		context.clearRect(width * 0.2, height * 0.2, width * 0.2, height * 0.2);

		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('PNG encoding failed');
		return Array.from(new Uint8Array(await blob.arrayBuffer()));
	}

	async function normalize(bytes: number[], type: string) {
		const normalized = await normalizeArtwork(new Blob([new Uint8Array(bytes)], { type }), type);
		return {
			width: normalized.width,
			height: normalized.height,
			type: normalized.type,
			size: normalized.blob.size
		};
	}

	async function handleFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const normalized = await normalizeArtwork(file, file.type);
			if (preview) URL.revokeObjectURL(preview);
			preview = URL.createObjectURL(normalized.blob);
			status = `${normalized.width} × ${normalized.height} · ${normalized.type} · ${normalized.blob.size} bytes`;
		} catch (error) {
			status = error instanceof Error ? error.message : String(error);
		} finally {
			input.value = '';
		}
	}

	onMount(() => {
		const api: MediaHarnessApi = { createPng, normalize };
		window.__remiMedia = api;

		return () => {
			delete window.__remiMedia;
			if (preview) URL.revokeObjectURL(preview);
		};
	});
</script>

<svelte:head>
	<title>Media harness — Remi</title>
</svelte:head>

<main>
	<h1>Media harness</h1>
	<p>Diagnostic surface for upload normalization. Not product UI.</p>

	<label>
		Upload image
		<input
			data-testid="upload"
			type="file"
			accept="image/png,image/jpeg,image/webp"
			onchange={handleFile}
		/>
	</label>

	<p data-testid="status">{status}</p>
	{#if preview}
		<img src={preview} alt="Normalized upload preview" width="240" />
	{/if}
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		padding: 20px;
		max-width: 640px;
	}
	img {
		border: 1px solid #c9c2b2;
		display: block;
		margin-top: 12px;
	}
</style>
