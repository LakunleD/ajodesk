export const SCOPES = [
  'contributors:read',
  'contributors:write',
  'plans:read',
  'plans:write',
  'enrollments:read',
  'enrollments:write',
  'contributions:read',
  'contributions:prepare',
  'contributions:confirm',
] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

/** True when every required scope is granted. */
export function hasScopes(granted: readonly string[], required: readonly Scope[]): boolean {
  return required.every((scope) => granted.includes(scope));
}
