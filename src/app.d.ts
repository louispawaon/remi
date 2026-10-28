// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		__remiHarness?: import('./lib/dev/harness-api').HarnessApi;
		__remiLibrary?: import('./lib/dev/library-api').LibraryHarnessApi;
	}
}

export {};
