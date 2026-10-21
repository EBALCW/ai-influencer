export function isSafeNextPath(
  value: string | null | undefined,
): value is string {
  return Boolean(
    value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\r\n\\]/.test(value),
  );
}

export function isAllowedBootstrapEmail(
  candidate: string | null | undefined,
  configuredEmail: string | null | undefined,
) {
  const normalizedCandidate = candidate?.trim().toLowerCase();
  const normalizedConfigured = configuredEmail?.trim().toLowerCase();
  return Boolean(
    normalizedCandidate &&
    normalizedConfigured &&
    normalizedCandidate === normalizedConfigured,
  );
}
