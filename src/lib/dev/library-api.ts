import type { CardDocument } from '#lib/card/types';

export interface LibraryCardView {
	id: string;
	title: string;
	revision: number;
	itemCount: number;
	unplacedCount: number;
	updatedAt: string;
	thumbnailBytes: number;
}

export interface LibraryHarnessApi {
	reset(): Promise<void>;
	createEmpty(): Promise<string>;
	createFixture(): Promise<string>;
	list(): Promise<LibraryCardView[]>;
	load(id: string): Promise<{ document: CardDocument; artwork: string[] } | null>;
	open(id: string): Promise<void>;
	rename(id: string, title: string): Promise<void>;
	duplicate(id: string): Promise<string>;
	remove(id: string): Promise<void>;
	updateTitle(title: string): Promise<void>;
	status(): string;
	exportBytes(id: string): Promise<number[]>;
	importBytes(bytes: number[]): Promise<string>;
}
