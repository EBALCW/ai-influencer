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
