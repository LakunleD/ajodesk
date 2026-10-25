import { hasScopes, isScope } from './scopes';

describe('scopes', () => {
  it('requires every listed scope', () => {
    expect(hasScopes(['contributions:read'], ['contributions:read'])).toBe(true);
    expect(hasScopes(['contributions:read'], ['contributions:read', 'contributions:prepare'])).toBe(
      false,
    );
    expect(hasScopes([], [])).toBe(true);
  });

  it('rejects unknown scope names', () => {
    expect(isScope('contributions:confirm')).toBe(true);
    expect(isScope('contributions:*')).toBe(false);
    expect(isScope('admin')).toBe(false);
  });
});
