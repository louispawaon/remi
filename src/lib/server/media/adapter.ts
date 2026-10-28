import type { Category } from '#lib/card/types';
import type { MediaOptions, MediaSearchRequest, MediaSearchResult } from '#lib/media/types';

export interface MediaAdapter {
	search(request: MediaSearchRequest, signal?: AbortSignal): Promise<MediaSearchResult>;
	options(category: Category, signal?: AbortSignal): Promise<MediaOptions>;
}
