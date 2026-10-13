import * as path from 'path';

/** Resolve an app URL path only when it remains inside the packaged renderer. */
export function resolveRendererPath(rendererDist: string, pathname: string): string | null {
	// URL paths start with '/', but must be resolved relative to the renderer directory.
	const relativePath = pathname.replace(/^[\/\\]+/, '');
	const filePath = path.resolve(rendererDist, relativePath);
	const relative = path.relative(rendererDist, filePath);
	if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
	return filePath;
}
