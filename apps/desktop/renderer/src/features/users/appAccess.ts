import type { AppAccess, LicenceUsageDto } from '../../lib/api';

export const APP_ACCESS_OPTIONS: { value: AppAccess; label: string }[] = [
	{ value: 'Both', label: 'Windows + Android' },
	{ value: 'Windows', label: 'Windows only' },
	{ value: 'Android', label: 'Android only' },
];

export function appAccessLabel(access: AppAccess): string {
	return APP_ACCESS_OPTIONS.find((o) => o.value === access)?.label ?? access;
}

/** Licences of a type not taken by an active user. */
export function freeLicences(licences: LicenceUsageDto[] | null | undefined, access: AppAccess): number {
	const l = licences?.find((x) => x.appAccess === access);
	return l ? l.total - l.used : 0;
}
