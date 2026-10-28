<script lang="ts">
	import { onMount } from 'svelte';
	import { createProjectArchive, readProjectArchive } from '#lib/card/archive';
	import { createFixtureDocument } from '#lib/card/fixture';
	import { renderCard, renderCardPng } from '#lib/card/png';
	import type { Format, GridSize, Resolution } from '#lib/card/types';
	import { createFixtureArtwork, recordFor } from '#lib/dev/artwork';
	import type { HarnessApi, HarnessRenderResult } from '#lib/dev/harness-api';

	let gridSize = $state<GridSize>(5);
	let format = $state<Format>('4:5');
	let resolution = $state<Resolution>(1);
	let status = $state('Ready');
	let canvasHost: HTMLDivElement;

	let artworkPromise: Promise<Record<string, Blob>> | undefined;
	let record: ReturnType<typeof recordFor> | null = null;
	let lastPng: Blob | null = null;

	function artwork() {
		artworkPromise ??= createFixtureArtwork();
		return artworkPromise;
	}

	function currentRecord() {
		if (!record) throw new Error('Nothing rendered yet');
		return record;
	}

	function mountCanvas(canvas: HTMLCanvasElement) {
		canvas.style.width = '100%';
		canvas.style.height = 'auto';
		canvas.style.maxWidth = '520px';
		canvas.style.border = '1px solid #3a3630';
		// eslint-disable-next-line svelte/no-dom-manipulating -- the harness owns this canvas host
		canvasHost.replaceChildren(canvas);
	}

	function samplePixels(
		canvas: HTMLCanvasElement,
		cells: { x: number; y: number; width: number; height: number }[],
		freeCellIndex: number | null
	) {
		const context = canvas.getContext('2d');
		if (!context) return [];
		const indices = [
			...new Set([0, 1, 2, 3, cells.length - 1, ...(freeCellIndex === null ? [] : [freeCellIndex])])
		];
		return indices.map((index) => {
			const cell = cells[index];
			const pixel = context.getImageData(
				Math.floor(cell.x + cell.width / 2),
				Math.floor(cell.y + cell.height / 2),
				1,
				1
			).data;
			return [pixel[0], pixel[1], pixel[2], pixel[3]];
		});
	}

	async function renderFixture(
		grid: GridSize = gridSize,
		cardFormat: Format = format,
		cardResolution: Resolution = resolution
	): Promise<HarnessRenderResult> {
		status = 'Rendering…';
		try {
			record = recordFor(
				createFixtureDocument({ gridSize: grid, format: cardFormat }),
				await artwork()
			);
			const rendered = await renderCard(record, cardResolution);
			mountCanvas(rendered.canvas);
			lastPng = null;
			status = `Rendered ${rendered.layout.width} × ${rendered.layout.height}`;
			return {
				width: rendered.canvas.width,
				height: rendered.canvas.height,
				samples: samplePixels(rendered.canvas, rendered.layout.cells, rendered.layout.freeCellIndex)
			};
		} catch (error) {
			status = `Render failed: ${message(error)}`;
			throw error;
		}
	}

	async function renderCurrent(
		cardResolution: Resolution = resolution
	): Promise<HarnessRenderResult> {
		const rendered = await renderCard(currentRecord(), cardResolution);
		mountCanvas(rendered.canvas);
		lastPng = null;
		status = `Rendered ${rendered.layout.width} × ${rendered.layout.height}`;
		return {
			width: rendered.canvas.width,
			height: rendered.canvas.height,
			samples: samplePixels(rendered.canvas, rendered.layout.cells, rendered.layout.freeCellIndex)
		};
	}

	async function preparePng() {
		if (!lastPng) {
			lastPng = (await renderCardPng(currentRecord(), resolution)).blob;
		}
		return lastPng;
	}

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

	async function downloadPng() {
		const blob = await preparePng();
		download(blob, `remi-${format.replace(':', 'x')}-${resolution}x.png`);
	}

	async function openImage() {
		const url = URL.createObjectURL(await preparePng());
		window.open(url, '_blank');
	}

	async function exportProject() {
		const archive = await createProjectArchive(currentRecord());
		download(new Blob([new Uint8Array(archive)], { type: 'application/zip' }), 'remi-fixture.remi');
	}

	async function importProject(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			record = readProjectArchive(new Uint8Array(await file.arrayBuffer()));
			gridSize = record.document.gridSize;
			format = record.document.format;
			resolution = 1;
			await renderCurrent();
			status = `Imported “${record.document.title}” with ${record.document.items.length} items`;
		} catch (error) {
			status = `Import failed: ${message(error)}`;
		} finally {
			input.value = '';
		}
	}

	async function missingArtworkError(): Promise<string | null> {
		try {
			const document = createFixtureDocument();
			const artworkMap = { ...(await artwork()) };
			delete artworkMap['art-jp'];
			await renderCard(recordFor(document, artworkMap), 1);
			return null;
		} catch (error) {
			return message(error);
		}
	}

	function message(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}

	onMount(() => {
		const api: HarnessApi = {
			renderMatrix: async () => {
				const entries = [];
				for (const grid of [3, 4, 5] as GridSize[]) {
					for (const cardFormat of ['4:5', '3:4', '9:16', '1:1'] as Format[]) {
						for (const cardResolution of [1, 2] as Resolution[]) {
							const fixture = recordFor(
								createFixtureDocument({ gridSize: grid, format: cardFormat }),
								await artwork()
							);
							const rendered = await renderCard(fixture, cardResolution);
							entries.push({
								gridSize: grid,
								format: cardFormat,
								resolution: cardResolution,
								width: rendered.canvas.width,
								height: rendered.canvas.height
							});
							rendered.canvas.width = 0;
							rendered.canvas.height = 0;
						}
					}
				}
				return entries;
			},
			render: renderFixture,
			renderCurrent,
			state: () => record?.document ?? null,
			importBytes: async (bytes: number[]) => {
				record = readProjectArchive(new Uint8Array(bytes));
				gridSize = record.document.gridSize;
				format = record.document.format;
				await renderCurrent();
			},
			missingArtworkError
		};
		window.__remiHarness = api;
		void renderFixture();

		return () => {
			delete window.__remiHarness;
		};
	});
</script>

<svelte:head>
	<title>Render harness — Remi</title>
</svelte:head>

<main>
	<h1>Render harness</h1>
	<p>
		Diagnostic surface for render, PNG, and project round-trip checks. Not part of the product UI.
	</p>

	<div>
		<label>
			Grid
			<select data-testid="grid" bind:value={gridSize}>
				<option value={3}>3 × 3</option>
				<option value={4}>4 × 4</option>
				<option value={5}>5 × 5</option>
			</select>
		</label>
		<label>
			Format
			<select data-testid="format" bind:value={format}>
				<option value="4:5">4:5</option>
				<option value="3:4">3:4</option>
				<option value="9:16">9:16</option>
				<option value="1:1">1:1</option>
			</select>
		</label>
		<label>
			Resolution
			<select data-testid="resolution" bind:value={resolution}>
				<option value={1}>Standard</option>
				<option value={2}>2×</option>
			</select>
		</label>
		<button data-testid="render" onclick={() => renderFixture()}>Render</button>
	</div>

	<div>
		<button data-testid="download-png" onclick={downloadPng}>Download PNG</button>
		<button data-testid="open-image" onclick={openImage}>Open image</button>
		<button data-testid="export-project" onclick={exportProject}>Export project</button>
		<label>
			Import project
			<input
				data-testid="import-input"
				type="file"
				accept=".remi,application/zip"
				onchange={importProject}
			/>
		</label>
	</div>

	<p data-testid="status">{status}</p>
	<div bind:this={canvasHost}></div>
</main>
