import type { PublicCatalog } from './types';
export function featureName(catalog: PublicCatalog, key: string): string {
	return catalog.features.find((f) => f.key === key)?.label || key;
}
