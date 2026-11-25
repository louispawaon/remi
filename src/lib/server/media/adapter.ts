import type { Category } from '#lib/card/types';
import type {
	MediaOptions,
	MediaResult,
	MediaSearchRequest,
	MediaSearchResult
} from '#lib/media/types';

export interface MediaAdapter {
	search(request: MediaSearchRequest, signal?: AbortSignal): Promise<MediaSearchResult>;
	options(category: Category, signal?: AbortSignal): Promise<MediaOptions>;
	/** Optional cast browse for media that exposes roles from a title. */
	cast?(category: Category, id: string, signal?: AbortSignal): Promise<MediaResult[]>;
}
