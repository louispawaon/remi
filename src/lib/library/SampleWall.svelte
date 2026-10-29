<script lang="ts">
	type Cell = {
		title: string;
		meta: string;
		tone: 'butter' | 'cobalt' | 'black';
		mark?: string;
		free?: boolean;
	};

	const cells: Cell[] = [
		{ title: 'Night Shift', meta: 'Film · 2024', tone: 'butter', mark: '01' },
		{ title: 'Blue Hour', meta: 'Series', tone: 'cobalt' },
		{ title: 'Salt & Static', meta: 'Album', tone: 'black', mark: 'A' },
		{ title: 'The Long Take', meta: 'Film', tone: 'cobalt' },
		{ title: 'Free', meta: 'Space', tone: 'butter', free: true },
		{ title: 'Paper Tiger', meta: 'Manga', tone: 'butter', mark: '02' },
		{ title: 'Low Tide', meta: 'Series', tone: 'black', mark: 'B' },
		{ title: 'After Dark', meta: 'Album', tone: 'cobalt' },
		{ title: 'West Wind', meta: 'Film · 2023', tone: 'butter' }
	];
</script>

<div class="sample-wall" aria-hidden="true">
	{#each cells as cell, index (index)}
		{#if cell.free}
			<div class="tile free">
				<span class="free-mark">Remi</span>
				<span class="free-label">Free space</span>
			</div>
		{:else}
			<div class="tile tone-{cell.tone}" data-mark={cell.mark ?? ''}>
				<span class="tile-meta">{cell.meta}</span>
				<span class="tile-title">{cell.title}</span>
			</div>
		{/if}
	{/each}
</div>

<style>
	.sample-wall {
		container-type: inline-size;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: 2.2cqw;
		width: 100%;
		aspect-ratio: 1;
	}

	.tile {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 1.4cqw;
		min-width: 0;
		padding: 4.6cqw;
	}

	.tile-meta,
	.tile-title,
	.free-mark,
	.free-label {
		position: relative;
		z-index: 1;
	}

	.tile-meta {
		font-size: 1.7cqw;
		font-weight: 700;
		letter-spacing: 0.12em;
		line-height: 1.2;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
	}

	.tile-title {
		font-family: var(--display);
		font-size: 4.2cqw;
		font-weight: 800;
		letter-spacing: -0.035em;
		line-height: 0.9;
		text-transform: uppercase;
		hyphens: none;
	}

	.tile::before {
		content: attr(data-mark);
		position: absolute;
		top: -1.5cqw;
		right: 2cqw;
		font-family: var(--display);
		font-size: 22cqw;
		font-weight: 800;
		letter-spacing: -0.06em;
		line-height: 0.72;
		pointer-events: none;
	}

	.tone-butter {
		background: var(--ink);
		color: var(--on-action);
	}
	.tone-butter .tile-meta {
		color: color-mix(in srgb, var(--on-action) 82%, transparent);
	}
	.tone-butter::before {
		color: color-mix(in srgb, var(--on-action) 14%, transparent);
	}

	.tone-cobalt {
		background: var(--ground);
		color: var(--ink);
	}
	.tone-cobalt .tile-meta {
		color: color-mix(in srgb, var(--ink) 76%, transparent);
	}

	.tone-black {
		background: var(--card);
		color: var(--card-ink);
	}
	.tone-black .tile-meta {
		color: color-mix(in srgb, var(--card-ink) 68%, transparent);
	}
	.tone-black::before {
		color: color-mix(in srgb, var(--card-ink) 22%, transparent);
	}

	.free {
		align-items: center;
		justify-content: center;
		gap: 1.2cqw;
		background: var(--action);
		color: var(--on-action);
		text-align: center;
	}

	.free-mark {
		font-family: var(--display);
		font-size: 7.4cqw;
		font-weight: 800;
		letter-spacing: -0.045em;
		line-height: 0.8;
		text-transform: uppercase;
	}

	.free-label {
		font-size: 1.6cqw;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
</style>
