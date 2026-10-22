// pnpm codemap için saf yardımcılar (dosya sistemi erişimi yok, test edilebilir).

/** apps/panel/src/app altındaki göreli yolu URL'ye çevirir: (grup) segmentleri düşer. */
export function routeFromAppPath(relPath) {
  const parts = relPath.split(/[\\/]/).slice(0, -1);
  const segs = parts.filter((p) => !(p.startsWith('(') && p.endsWith(')')));
  return '/' + segs.join('/');
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** route.ts içeriğinden export edilen HTTP metotları. */
export function routeMethods(source) {
  return METHODS.filter((m) =>
    new RegExp(
      `export\\s+(?:async\\s+)?(?:function\\s+${m}\\b|const\\s+${m}\\b)|export\\s*\\{[^}]*\\b${m}\\b`,
    ).test(source),
  );
}

/** TS/JS kaynağındaki üst düzey export adları (re-export dahil, tipler hariç değil). */
export function exportedNames(source) {
  const names = new Set();
  const decl =
    /export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of source.matchAll(decl)) names.add(m[1]);
  const list = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  for (const m of source.matchAll(list)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\s+(?!async|function|class)/.test(source)) {
    names.add('default');
  }
  return [...names];
}

const SQL_OBJECTS = [
  ['table', /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."]+)/gi],
  ['view', /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([\w."]+)/gi],
  ['function', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w."]+)/gi],
  ['type', /CREATE\s+TYPE\s+([\w."]+)/gi],
  ['trigger', /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([\w"]+)/gi],
  ['policy', /CREATE\s+POLICY\s+("[^"]+"|[\w]+)/gi],
  ['column', /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w"]+)/gi],
  ['cron', /cron\.schedule\(\s*'([^']+)'/gi],
];

/** Migration SQL'inde oluşturulan nesneler, türe göre (yorum satırları atlanır). */
export function sqlObjects(sql) {
  const clean = sql.replace(/--.*$/gm, '');
  const out = {};
  for (const [kind, re] of SQL_OBJECTS) {
    const found = [...clean.matchAll(re)].map((m) =>
      m[1].replaceAll('"', '').replace(/^public\./, ''),
    );
    if (found.length) out[kind] = [...new Set(found)];
  }
  return out;
}

/** pgTAP / Vitest / Deno / Playwright dosyasındaki test sayısı (yaklaşık). */
export function countTests(source) {
  // pgTAP: plan(N) toplamı kesin sayıdır
  const plans = [...source.matchAll(/\bplan\(\s*(\d+)\s*\)/gi)];
  if (plans.length) return plans.reduce((s, m) => s + Number(m[1]), 0);
  const n = (re) => (source.match(re) ?? []).length;
  return (
    n(/(?<![.\w])(?:it|test)(?:\.(?:only|skip))?\s*\(/g) +
    n(/\bDeno\.test\s*\(/g)
  );
}
