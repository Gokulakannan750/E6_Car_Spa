import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { resolveRendererPath } from './rendererPath';

describe('packaged renderer path containment', () => {
	const root = path.resolve('test-app', 'dist-renderer');

	it('resolves application routes and assets', () => {
		expect(resolveRendererPath(root, '/index.html')).toBe(path.join(root, 'index.html'));
		expect(resolveRendererPath(root, '/assets/main.js')).toBe(path.join(root, 'assets', 'main.js'));
	});

	it('blocks traversal into a sibling directory sharing the renderer prefix', () => {
		expect(resolveRendererPath(root, '/../dist-renderer-private/secret.txt')).toBeNull();
		expect(resolveRendererPath(root, '/assets/../../secret.txt')).toBeNull();
	});

	it('blocks Windows path traversal and absolute drive paths', () => {
		if (process.platform !== 'win32') return;
		expect(resolveRendererPath(root, '/..\\dist-renderer-private\\secret.txt')).toBeNull();
		expect(resolveRendererPath(root, '/C:\\outside\\secret.txt')).toBeNull();
	});
});
