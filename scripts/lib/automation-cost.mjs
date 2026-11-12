const scenarios = ['image', 'image_to_video', 'video_to_video'];
const methods = ['manual', 'mcp'];
const scale = 1_000_000n;

// Tutarlar ondalık metin olarak alınır; para hesabında kayan nokta kullanılmaz.
function decimal(value, field) {
  if (typeof value !== 'string' || !/^\d{1,9}(\.\d{1,6})?$/.test(value))
    throw new Error(
      `${field}: negatif olmayan, en çok 6 ondalıklı metin gerekli.`,
    );
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'));
}
function format(value) {
  return `${value / scale}.${String(value % scale).padStart(6, '0')}`;
}
function text(value) {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 120
  );
}

export function compareAutomation(rows) {
  if (!Array.isArray(rows) || rows.length > 10_000)
    throw new Error('Girdi en çok 10000 denemelik bir JSON listesi olmalı.');
  const ids = new Set();
  const setups = new Map();
  const normalized = rows.map((row) => {
    if (
      !row ||
      !text(row.id) ||
      ids.has(row.id) ||
      !scenarios.includes(row.scenario) ||
      !methods.includes(row.method) ||
      row.billing !== 'higgsfield_subscription' ||
      !text(row.setup_id) ||
      !text(row.model) ||
      !['succeeded', 'failed'].includes(row.status) ||
      !['passed', 'failed', 'not_reviewed'].includes(row.qc) ||
      (row.method === 'mcp' && !text(row.assistant_model)) ||
      (row.quality !== null &&
        (!Number.isInteger(row.quality) ||
          row.quality < 1 ||
          row.quality > 5)) ||
      (row.status === 'failed' &&
        (row.qc !== 'not_reviewed' || row.quality !== null)) ||
      (row.status === 'succeeded' &&
        row.qc === 'not_reviewed' &&
        row.quality !== null) ||
      (row.qc !== 'not_reviewed' && row.quality === null)
    )
      throw new Error(
        'Deneme kimliği, senaryo, yöntem, model, sonuç veya QC geçersiz.',
      );
    ids.add(row.id);
    const setup = JSON.stringify([row.setup_id, row.model]);
    if (setups.has(row.scenario) && setups.get(row.scenario) !== setup)
      throw new Error(
        'Aynı senaryoda referans/prompt/ayar ve model eşleşmeli.',
      );
    setups.set(row.scenario, setup);
    return {
      ...row,
      credits: decimal(row.credits, 'credits'),
      minutes: decimal(row.minutes, 'minutes'),
      generation_usd:
        row.generation_usd === null
          ? null
          : decimal(row.generation_usd, 'generation_usd'),
      assistant_usd:
        row.assistant_usd === null
          ? null
          : decimal(row.assistant_usd, 'assistant_usd'),
    };
  });

  const groups = scenarios.flatMap((scenario) =>
    methods.map((method) => {
      const entries = normalized.filter(
        (row) => row.scenario === scenario && row.method === method,
      );
      const sum = (field, subset = entries) =>
        subset.reduce((total, row) => total + row[field], 0n);
      const failed = entries.filter((row) => row.status === 'failed');
      const passed = entries.filter((row) => row.qc === 'passed');
      const reviewed = entries.filter((row) => row.quality !== null);
      const missingMoney = entries.filter(
        (row) => row.generation_usd === null || row.assistant_usd === null,
      ).length;
      const completeMoney = entries.length > 0 && missingMoney === 0;
      const totalUsd = completeMoney
        ? sum('generation_usd') + sum('assistant_usd')
        : null;
      return {
        scenario,
        method,
        model: entries[0]?.model ?? null,
        assistant_models: [
          ...new Set(
            entries
              .filter((row) => row.method === 'mcp')
              .map((row) => row.assistant_model),
          ),
        ],
        attempts: entries.length,
        succeeded: entries.filter((row) => row.status === 'succeeded').length,
        qc_passed: passed.length,
        qc_failed: entries.filter((row) => row.qc === 'failed').length,
        pending_qc: entries.filter(
          (row) => row.status === 'succeeded' && row.qc === 'not_reviewed',
        ).length,
        credits: entries.length ? format(sum('credits')) : null,
        minutes: entries.length ? format(sum('minutes')) : null,
        failed_credits: entries.length ? format(sum('credits', failed)) : null,
        technical_failure_percent: entries.length
          ? ((failed.length * 100) / entries.length).toFixed(2)
          : null,
        mean_quality: reviewed.length
          ? (
              reviewed.reduce((total, row) => total + row.quality, 0) /
              reviewed.length
            ).toFixed(2)
          : null,
        missing_usd: missingMoney,
        generation_usd: completeMoney ? format(sum('generation_usd')) : null,
        assistant_usd: completeMoney ? format(sum('assistant_usd')) : null,
        total_usd: totalUsd === null ? null : format(totalUsd),
        failed_usd: completeMoney
          ? format(sum('generation_usd', failed) + sum('assistant_usd', failed))
          : null,
        credits_per_usable_output: passed.length
          ? format(sum('credits') / BigInt(passed.length))
          : null,
        usd_per_usable_output:
          passed.length && totalUsd !== null
            ? format(totalUsd / BigInt(passed.length))
            : null,
      };
    }),
  );
  return {
    // Altı hücre ölçülmüş olsa da bakiye mutabakatı ve insan kararı ayrıca gerekir.
    measurement_complete: groups.every(
      (group) =>
        group.attempts > 0 && group.pending_qc === 0 && group.missing_usd === 0,
    ),
    groups,
  };
}
