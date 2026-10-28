import {
	isFreeSpaceCell,
	randomId,
	removeItem as withoutItem,
	renameDocument as withTitle,
	resizeGrid as withGrid,
	setFormat as withFormat,
	setFreeSpace as withFreeSpace,
	unplacedItems
} from '#lib/card/document';
import { shuffleDocument } from '#lib/card/shuffle';
import type { CardDocument, CardItem, CardRecord, Category } from '#lib/card/types';
import type { NormalizedArtwork } from '#lib/media/artwork';
import { Autosave, type AutosaveStatus } from '#lib/library/autosave';
import { saveCard } from '#lib/library/store';
import { createThumbnail } from '#lib/library/thumbnail';

export type EditorTool = 'preview' | 'add' | 'arrange' | 'style';

export class EditorState {
	record = $state.raw<CardRecord>({} as CardRecord);
	status = $state<AutosaveStatus>('saved');
	statusDetail = $state<string | undefined>(undefined);
	selectedSlot = $state<number | null>(null);
	selectedItemId = $state<string | null>(null);
	movingItemId = $state<string | null>(null);
	tool = $state<EditorTool>('arrange');
	addCategory = $state<Category>('anime');
	zoom = $state<'fit' | 'actual'>('fit');

	readonly #autosave: Autosave;
	#thumbnailDirty = false;

	constructor(record: CardRecord) {
		this.record = record;
		this.#autosave = new Autosave(record, (next) => this.#save(next), {
			debounceMs: 500,
			onStatus: (status, detail) => {
				this.status = status;
				this.statusDetail = detail;
			},
			onSaved: (saved) => {
				this.record = saved;
			}
		});
	}

	get document(): CardDocument {
		return this.record.document;
	}

	get selectedItem(): CardItem | null {
		return this.document.items.find((item) => item.id === this.selectedItemId) ?? null;
	}

	get movingItem(): CardItem | null {
		return this.document.items.find((item) => item.id === this.movingItemId) ?? null;
	}

	get unplaced(): CardItem[] {
		return unplacedItems(this.document);
	}

	setTitle(title: string): void {
		this.#mutate(withTitle(this.document, title), false);
	}

	setFormat(format: CardDocument['format']): void {
		this.#mutate(withFormat(this.document, format));
		this.#reconcileSelection();
	}

	setGridSize(gridSize: CardDocument['gridSize']): void {
		this.#mutate(withGrid(this.document, gridSize));
		this.#reconcileSelection();
	}

	setFreeSpace(enabled: boolean): void {
		this.#mutate(withFreeSpace(this.document, enabled));
		this.#reconcileSelection();
	}

	selectSlot(index: number): void {
		if (this.movingItemId) {
			this.placeMovingItem(index);
			return;
		}
		if (isFreeSpaceCell(this.document, index)) return;
		this.selectedSlot = index;
		this.selectedItemId = this.document.slots[index] ?? null;
	}

	beginMove(itemId: string): void {
		this.selectedItemId = itemId;
		this.selectedSlot = this.document.slots.indexOf(itemId);
		if (this.selectedSlot < 0) this.selectedSlot = null;
		this.movingItemId = itemId;
	}

	cancelMove(): void {
		this.movingItemId = null;
	}

	placeMovingItem(index: number): void {
		if (!this.movingItemId || isFreeSpaceCell(this.document, index)) return;
		this.placeItem(this.movingItemId, index);
		this.movingItemId = null;
	}

	placeItem(itemId: string, index: number): void {
		const document = this.document;
		if (index < 0 || index >= document.slots.length || isFreeSpaceCell(document, index)) return;

		const slots = [...document.slots];
		const source = slots.indexOf(itemId);
		const target = slots[index];
		if (source >= 0) slots[source] = target ?? null;
		slots[index] = itemId;

		this.#mutate({ ...document, slots });
		this.selectedSlot = index;
		this.selectedItemId = itemId;
	}

	unplace(itemId: string): void {
		const document = this.document;
		const slots = document.slots.map((slot) => (slot === itemId ? null : slot));
		this.#mutate({ ...document, slots });
		this.selectedSlot = null;
		this.selectedItemId = itemId;
	}

	removeSelectedItem(): void {
		if (this.selectedItemId) this.removeItem(this.selectedItemId);
	}

	removeItem(itemId: string): void {
		const item = this.document.items.find((candidate) => candidate.id === itemId);
		if (!item) return;
		const document = withoutItem(this.document, item.id);
		const artwork = this.#dropArtwork(item.artwork?.id, document, this.record.artwork);
		this.record = { document, artwork };
		this.#queue();
		if (this.selectedItemId === itemId) {
			this.selectedItemId = null;
			this.selectedSlot = null;
		}
		if (this.movingItemId === itemId) this.movingItemId = null;
	}

	shuffle(): void {
		this.#mutate(shuffleDocument(this.document));
		this.#reconcileSelection();
	}

	addItem(item: CardItem, blob: Blob | null): void {
		const document = this.document;
		const slots = [...document.slots];
		const free = document.freeSpace && document.gridSize % 2 === 1;
		const centre = free ? (document.slots.length - 1) / 2 : -1;
		const target = slots.findIndex((slot, index) => slot === null && index !== centre);

		if (target >= 0) slots[target] = item.id;

		const artwork = { ...this.record.artwork };
		if (blob && item.artwork) artwork[item.artwork.id] = blob;

		this.record = { document: { ...document, items: [...document.items, item], slots }, artwork };
		this.#queue();
		this.selectedItemId = item.id;
		this.selectedSlot = target >= 0 ? target : null;
	}

	replaceSelectedArtwork(normalized: NormalizedArtwork): void {
		const item = this.selectedItem;
		if (!item) return;

		const document = this.document;
		const oldId = item.artwork?.id;
		const artworkId = randomId();
		const items = document.items.map((candidate) =>
			candidate.id === item.id
				? {
						...candidate,
						artwork: {
							id: artworkId,
							type: normalized.type,
							width: normalized.width,
							height: normalized.height
						}
					}
				: candidate
		);
		let artwork = { ...this.record.artwork, [artworkId]: normalized.blob };
		artwork = this.#dropArtwork(oldId, { ...document, items }, artwork);

		this.record = { document: { ...document, items }, artwork };
		this.#queue();
	}

	setItemTitle(title: string): void {
		const item = this.selectedItem;
		if (!item) return;
		const value = title.trim();
		const items = this.document.items.map((candidate) =>
			candidate.id === item.id ? { ...candidate, titleOverride: value || null } : candidate
		);
		this.#mutate({ ...this.document, items }, false);
	}

	setCrop(x: number, y: number): void {
		const item = this.selectedItem;
		if (!item) return;
		const clamped = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
		const items = this.document.items.map((candidate) =>
			candidate.id === item.id
				? { ...candidate, crops: { ...candidate.crops, [this.document.format]: clamped } }
				: candidate
		);
		this.#mutate({ ...this.document, items });
	}

	centerCrop(): void {
		const item = this.selectedItem;
		if (!item) return;
		const crops = { ...item.crops };
		delete crops[this.document.format];
		const items = this.document.items.map((candidate) =>
			candidate.id === item.id ? { ...candidate, crops } : candidate
		);
		this.#mutate({ ...this.document, items });
	}

	setAppearance(patch: Partial<CardDocument['appearance']>): void {
		this.#mutate({
			...this.document,
			appearance: { ...this.document.appearance, ...patch }
		});
	}

	setZoom(zoom: 'fit' | 'actual'): void {
		this.zoom = zoom;
	}

	setTool(tool: EditorTool): void {
		this.tool = tool;
		if (tool !== 'arrange') this.movingItemId = null;
	}

	setAddCategory(category: Category): void {
		this.addCategory = category;
	}

	async flush(): Promise<void> {
		await this.#autosave.flush();
	}

	dispose(): void {
		this.#autosave.dispose();
	}

	#mutate(document: CardDocument, thumbnailDirty = true): void {
		this.record = { ...this.record, document };
		this.#thumbnailDirty ||= thumbnailDirty;
		this.#autosave.update(this.record);
	}

	#queue(): void {
		this.#thumbnailDirty = true;
		this.#autosave.update(this.record);
	}

	#reconcileSelection(): void {
		const document = this.document;
		if (this.selectedItemId) {
			const index = document.slots.indexOf(this.selectedItemId);
			this.selectedSlot = index >= 0 ? index : null;
			if (this.selectedSlot !== null && isFreeSpaceCell(document, this.selectedSlot)) {
				this.selectedSlot = null;
			}
		} else if (this.selectedSlot !== null) {
			this.selectedSlot = this.selectedSlot < document.slots.length ? this.selectedSlot : null;
		}
		this.movingItemId = null;
	}

	#dropArtwork(
		artworkId: string | undefined,
		document: CardDocument,
		artwork: Record<string, Blob>
	): Record<string, Blob> {
		if (!artworkId) return artwork;
		if (document.items.some((item) => item.artwork?.id === artworkId)) return artwork;
		const next = { ...artwork };
		delete next[artworkId];
		return next;
	}

	async #save(next: CardRecord): Promise<CardRecord> {
		const thumbnailDirty = this.#thumbnailDirty;
		if (thumbnailDirty) this.#thumbnailDirty = false;

		try {
			let thumbnail: Blob | undefined;
			if (thumbnailDirty) {
				try {
					thumbnail = await createThumbnail(next);
				} catch {
					// A render problem must not block saving the working document.
				}
			}
			return await saveCard(next, thumbnail ? { thumbnail } : {});
		} catch (error) {
			if (thumbnailDirty) this.#thumbnailDirty = true;
			throw error;
		}
	}
}

export function statusLabel(status: AutosaveStatus, detail?: string): string {
	switch (status) {
		case 'dirty':
			return 'Unsaved changes';
		case 'saving':
			return 'Saving…';
		case 'saved':
			return 'Saved';
		case 'conflict':
			return 'Changed in another tab';
		case 'error':
			return detail ? `Save failed: ${detail}` : 'Save failed';
	}
}
