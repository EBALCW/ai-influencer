/** Analitik iç linkleri: `?inf=` seçimi her zaman korunur. */
export function analyticsHref(
  path: string,
  inf: string | null | undefined,
  params: Record<string, string | number | null | undefined> = {},
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== null && value !== undefined && value !== '')
      search.set(key, String(value));
  if (inf) search.set('inf', inf);
  // `ids=a,b` okunur kalsın: virgül kodlanmaz
  const query = search.toString().replaceAll('%2C', ',');
  return query ? `${path}?${query}` : path;
}

export const platformLabels = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
} as const;
