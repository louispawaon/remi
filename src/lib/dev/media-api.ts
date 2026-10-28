export interface MediaHarnessApi {
	createPng(width: number, height: number): Promise<number[]>;
	normalize(
		bytes: number[],
		type: string
	): Promise<{ width: number; height: number; type: string; size: number }>;
}
