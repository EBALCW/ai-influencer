import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTeamMemberEmails } from '@/lib/team-emails';
import type { WorkerRow } from './model';

/**
 * Anlatım ekranlarının okuma sorguları. Kullanıcı oturumuyla çalışır: RLS yalnız üyenin çalışma
 * alanını döndürür (viewer dahil). Çalışma alanı kimliği istekten alınmaz.
 */
type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type Series = Row<'series'>;
export type Episode = Row<'episodes'>;
export type TopicRequest = Row<'topic_requests'>;
export type TopicSuggestion = Row<'topic_suggestions'>;
export type ScriptVersion = Row<'episode_script_versions'>;

const EPISODE_LIST =
  'id, series_id, episode_number, title, kind, status, unsourced_claim_count, fact_notes, script_version, updated_at, archived_at' as const;
export type EpisodeListItem = Pick<
  Episode,
  | 'id'
  | 'series_id'
  | 'episode_number'
  | 'title'
  | 'kind'
  | 'status'
  | 'unsourced_claim_count'
  | 'script_version'
  | 'updated_at'
  | 'archived_at'
> & { has_fact_notes: boolean };

function fail(what: string): never {
  throw new Error(`${what} alınamadı.`);
}

function listItem(
  row: Pick<Episode, keyof Omit<EpisodeListItem, 'has_fact_notes'>> & {
    fact_notes: unknown;
  },
): EpisodeListItem {
  const { fact_notes, ...rest } = row;
  return {
    ...rest,
    has_fact_notes: Array.isArray(fact_notes) && fact_notes.length > 0,
  };
}

export type SeriesListItem = Series & {
  episodeCount: number;
  lastActivity: string;
};

export type RequestListItem = TopicRequest & {
  seriesName: string | null;
  total: number;
  open: number;
};

export type ExplainerOverview = {
  series: SeriesListItem[];
  standalone: EpisodeListItem[];
  requests: RequestListItem[];
};

const LIST_LIMIT = 200;

export async function getExplainerOverview(): Promise<ExplainerOverview> {
  const db = await createSupabaseServerClient();
  const [series, episodes, requests] = await Promise.all([
    db
      .from('series')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(500),
    db
      .from('episodes')
      .select(EPISODE_LIST)
      .order('updated_at', { ascending: false })
      .limit(1000),
    db
      .from('topic_requests')
      .select('*, topic_suggestions(status)')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (series.error) fail('Seriler');
  if (episodes.error) fail('Videolar');
  if (requests.error) fail('Konu istekleri');

  const bySeries = new Map<string, { count: number; last: string }>();
  for (const episode of episodes.data) {
    if (!episode.series_id || episode.archived_at) continue;
    const entry = bySeries.get(episode.series_id) ?? { count: 0, last: '' };
    entry.count += 1;
    if (episode.updated_at > entry.last) entry.last = episode.updated_at;
    bySeries.set(episode.series_id, entry);
  }
  const names = new Map(series.data.map((row) => [row.id, row.name]));
  return {
    series: series.data.map((row) => {
      const entry = bySeries.get(row.id);
      return {
        ...row,
        episodeCount: entry?.count ?? 0,
        lastActivity:
          entry && entry.last > row.updated_at ? entry.last : row.updated_at,
      };
    }),
    standalone: episodes.data
      .filter((episode) => !episode.series_id)
      .slice(0, LIST_LIMIT)
      .map(listItem),
    requests: requests.data.map(({ topic_suggestions, ...row }) => ({
      ...row,
      seriesName: row.series_id ? (names.get(row.series_id) ?? null) : null,
      total: topic_suggestions.length,
      open: topic_suggestions.filter((item) => item.status === 'new').length,
    })),
  };
}

/** Seri seçim listesi (form ve taşıma için): yalnız etkin seriler. */
export async function getActiveSeriesOptions(): Promise<
  Array<Pick<Series, 'id' | 'name' | 'kind' | 'language'>>
> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from('series')
    .select('id, name, kind, language')
    .eq('status', 'active')
    .order('name')
    .limit(500);
  if (error) fail('Seriler');
  return data;
}

export async function exists(
  table: 'series' | 'episodes' | 'topic_requests',
  id: string,
): Promise<boolean> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from(table)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('Kayıt');
  return data !== null;
}

export async function getSeries(id: string): Promise<Series | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from('series')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('Seri');
  return data;
}

export type SeriesDetail = {
  series: Series;
  episodes: EpisodeListItem[];
  requests: RequestListItem[];
};

export async function getSeriesDetail(
  id: string,
): Promise<SeriesDetail | null> {
  const db = await createSupabaseServerClient();
  const [series, episodes, requests] = await Promise.all([
    db.from('series').select('*').eq('id', id).maybeSingle(),
    db
      .from('episodes')
      .select(EPISODE_LIST)
      .eq('series_id', id)
      .order('episode_number')
      .limit(1000),
    db
      .from('topic_requests')
      .select('*, topic_suggestions(status)')
      .eq('series_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (series.error) fail('Seri');
  if (episodes.error) fail('Bölümler');
  if (requests.error) fail('Konu istekleri');
  const row = series.data;
  if (!row) return null;
  return {
    series: row,
    episodes: episodes.data.map(listItem),
    requests: requests.data.map(({ topic_suggestions, ...request }) => ({
      ...request,
      seriesName: row.name,
      total: topic_suggestions.length,
      open: topic_suggestions.filter((item) => item.status === 'new').length,
    })),
  };
}

export type TopicRequestDetail = {
  request: TopicRequest;
  series: Pick<Series, 'id' | 'name' | 'status'> | null;
  suggestions: Array<TopicSuggestion & { episodeId: string | null }>;
};

export async function getTopicRequest(
  id: string,
): Promise<TopicRequestDetail | null> {
  const db = await createSupabaseServerClient();
  const [request, suggestions] = await Promise.all([
    db
      .from('topic_requests')
      .select('*, series(id, name, status)')
      .eq('id', id)
      .maybeSingle(),
    db
      .from('topic_suggestions')
      .select('*, episodes(id)')
      .eq('request_id', id)
      .order('position'),
  ]);
  if (request.error) fail('Konu isteği');
  if (suggestions.error) fail('Öneriler');
  if (!request.data) return null;
  const { series, ...row } = request.data;
  return {
    request: row,
    series,
    suggestions: suggestions.data.map(({ episodes, ...item }) => ({
      ...item,
      episodeId: firstId(episodes),
    })),
  };
}

/** PostgREST tekil FK'yi nesne, çoğulu dizi döndürür; ikisini de karşılar. */
function firstId(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' && 'id' in row
    ? String((row as { id: unknown }).id)
    : null;
}

export type JobStageItem = Pick<
  Row<'job_stages'>,
  | 'seq'
  | 'key'
  | 'status'
  | 'progress'
  | 'detail'
  | 'error'
  | 'requires_approval'
  | 'approved_at'
>;
export type EpisodeJob = Pick<
  Row<'jobs'>,
  | 'id'
  | 'kind'
  | 'status'
  | 'progress'
  | 'current_stage'
  | 'stop_at'
  | 'error'
  | 'failed_stage'
  | 'episode_script_version'
  | 'required_capabilities'
  | 'cancel_requested_at'
  | 'created_at'
  | 'finished_at'
> & { stages: JobStageItem[] };

export type VersionItem = ScriptVersion & {
  authorEmail: string | null;
  approverEmail: string | null;
};

export type EpisodeDetail = {
  episode: Episode;
  series: Series | null;
  approverEmail: string | null;
  versions: VersionItem[];
  jobs: EpisodeJob[];
  workers: WorkerRow[];
  request: Pick<TopicRequest, 'id' | 'prompt'> | null;
};

const JOB_FIELDS =
  'id, kind, status, progress, current_stage, stop_at, error, failed_stage, episode_script_version, required_capabilities, cancel_requested_at, created_at, finished_at, job_stages(seq, key, status, progress, detail, error, requires_approval, approved_at)' as const;

async function listJobs(db: Db, episodeId: string): Promise<EpisodeJob[]> {
  const { data, error } = await db
    .from('jobs')
    .select(JOB_FIELDS)
    .eq('episode_id', episodeId)
    .order('created_at', { ascending: false })
    .order('seq', { referencedTable: 'job_stages' })
    .limit(10);
  if (error) fail('Üretim işleri');
  return data.map(({ job_stages, ...job }) => ({ ...job, stages: job_stages }));
}

async function listWorkers(db: Db): Promise<WorkerRow[]> {
  const { data, error } = await db
    .from('production_workers')
    .select('name, capabilities, last_seen_at, revoked_at');
  if (error) fail('Üretim makineleri');
  return data;
}

/** Üretim bölümünün canlı verisi (yoklama için): işler, aşamalar, makineler, bölüm durumu. */
export async function getEpisodeProduction(episodeId: string) {
  const db = await createSupabaseServerClient();
  const [episode, jobs, workers] = await Promise.all([
    db
      .from('episodes')
      .select('id, status, script_version')
      .eq('id', episodeId)
      .maybeSingle(),
    listJobs(db, episodeId),
    listWorkers(db),
  ]);
  if (episode.error) fail('Bölüm');
  if (!episode.data) return null;
  return { episode: episode.data, jobs, workers };
}

export async function getEpisode(
  id: string,
  workspaceId: string,
): Promise<EpisodeDetail | null> {
  const db = await createSupabaseServerClient();
  const [episode, versions, jobs, workers] = await Promise.all([
    db.from('episodes').select('*, series(*)').eq('id', id).maybeSingle(),
    db
      .from('episode_script_versions')
      .select('*')
      .eq('episode_id', id)
      .order('version', { ascending: false })
      .limit(100),
    listJobs(db, id),
    listWorkers(db),
  ]);
  if (episode.error) fail('Bölüm');
  if (versions.error) fail('Senaryo sürümleri');
  if (!episode.data) return null;
  const { series, ...row } = episode.data;

  let request: EpisodeDetail['request'] = null;
  if (row.suggestion_id) {
    const { data, error } = await db
      .from('topic_suggestions')
      .select('topic_requests(id, prompt)')
      .eq('id', row.suggestion_id)
      .maybeSingle();
    if (error) fail('Konu isteği');
    request = data?.topic_requests ?? null;
  }

  // E-postalar auth.users'ta durur; yardımcı yalnız bu çalışma alanının üyelerini döndürür.
  const emails = await getTeamMemberEmails(
    [
      row.script_approved_by,
      ...versions.data.flatMap((v) => [v.created_by, v.approved_by]),
    ],
    workspaceId,
  );
  const email = (userId: string | null) =>
    userId ? (emails.get(userId) ?? null) : null;
  return {
    episode: row,
    series,
    approverEmail: email(row.script_approved_by),
    versions: versions.data.map((version) => ({
      ...version,
      authorEmail: email(version.created_by),
      approverEmail: email(version.approved_by),
    })),
    jobs,
    workers,
    request,
  };
}

/** Senaryo paketinin güncel hâli ("başka biri değiştirdi" karşılaştırması için). */
export async function getEpisodeScript(id: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from('episodes')
    .select(
      'id, script_text, script, fact_notes, sensitivity_flags, sensitivity_note, script_version, status, updated_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) fail('Senaryo');
  return data;
}
