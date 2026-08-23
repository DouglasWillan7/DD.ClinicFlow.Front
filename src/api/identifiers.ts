const guidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseGuid(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && guidPattern.test(normalized) ? normalized : null;
}
