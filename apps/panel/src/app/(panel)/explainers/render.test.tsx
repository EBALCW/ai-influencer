import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  EpisodeDetail,
  TopicRequestDetail,
} from '@/lib/explainer/queries';
import { EpisodeWorkspace } from './episode-workspace';
import { ProductionPanel } from './production-panel';
import { SourceLink } from './shared';
import { Suggestions } from './suggestions';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const now = '2026-11-15T10:00:00Z';
const id = (n: number) => `d2160000-0000-4000-8000-00000000000${n}`;

function render(node: React.ReactElement): Document {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(node),
    'text/html',
  );
}

function episodeDetail(
  patch: Partial<EpisodeDetail['episode']>,
): EpisodeDetail {
  const episode = {
    id: id(1),
    workspace_id: id(9),
    series_id: null,
    episode_number: null,
    suggestion_id: null,
    title: 'Planör nasıl uçar',
    title_key: 'planor nasil ucar',
    kind: 'how_it_works',
    language: 'tr',
    summary: '',
    hook: '',
    visual_idea: '',
    script_text: 'Kanca.\nGiriş.',
    script: null,
    fact_notes: [
      {
        claim: '<img src=x onerror=alert(1)>',
        sources: [{ title: 'Tek kaynak', url: 'https://example.org/a' }],
      },
    ],
    unsourced_claim_count: 1,
    sensitivity_flags: [],
    sensitivity_note: null,
    script_version: 2,
    script_approved_by: null,
    script_approved_at: null,
    script_approved_version: null,
    script_approved_with_gaps: false,
    visual_route: 'hyperframes',
    style_key: null,
    voice_provider: null,
    voice_name: null,
    voice_rate: null,
    caption_style: null,
    params: {},
    params_snapshot: null,
    status: 'script_ready',
    published_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    ...patch,
  } as EpisodeDetail['episode'];
  return {
    episode,
    series: null,
    approverEmail: null,
    versions: [
      {
        id: id(3),
        workspace_id: id(9),
        episode_id: episode.id,
        version: 2,
        kind: 'how_it_works',
        language: 'tr',
        script_text: episode.script_text,
        script: null,
        fact_notes: episode.fact_notes,
        unsourced_claim_count: 1,
        sensitivity_flags: [],
        sensitivity_note: null,
        approved_by: null,
        approved_at: null,
        approved_with_gaps: false,
        created_at: now,
        created_by: null,
        authorEmail: null,
        approverEmail: null,
      },
      {
        id: id(4),
        workspace_id: id(9),
        episode_id: episode.id,
        version: 1,
        kind: 'how_it_works',
        language: 'tr',
        script_text: 'Kanca.',
        script: null,
        fact_notes: [],
        unsourced_claim_count: 0,
        sensitivity_flags: [],
        sensitivity_note: null,
        approved_by: id(5),
        approved_at: now,
        approved_with_gaps: true,
        created_at: now,
        created_by: null,
        authorEmail: null,
        approverEmail: null,
      },
    ] as EpisodeDetail['versions'],
    jobs: [],
    workers: [],
    request: null,
  };
}

describe('bölüm çalışma alanı (render)', () => {
  it('editör: kaynak eksiği, onay kutusu ve geçersiz kalan onay görünür', () => {
    const doc = render(
      <EpisodeWorkspace canWrite detail={episodeDetail({})} />,
    );
    const text = doc.body.textContent ?? '';
    expect(text).toContain('1 iddianın kaynağı eksik');
    expect(text).toContain('Kaynak eksiğini biliyorum, yine de onaylıyorum.');
    expect(text).toContain('Sürüm 1');
    expect(text).toContain('o onay geçersiz');
    // Kullanıcı metni HTML olarak işlenmez.
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('textarea')?.textContent).toContain('Kanca.');
    const approve = [...doc.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Senaryoyu onayla'),
    );
    // Eksik bilerek kabul edilmeden onay düğmesi kapalıdır.
    expect(approve?.hasAttribute('disabled')).toBe(true);
    expect(text).toContain('bu sürümü geri yükle');
  });

  it('viewer: alanlar kapalı, kaydet / onayla / geri yükle düğmesi yok', () => {
    const doc = render(
      <EpisodeWorkspace canWrite={false} detail={episodeDetail({})} />,
    );
    const labels = [...doc.querySelectorAll('button')].map(
      (button) => button.textContent ?? '',
    );
    expect(
      labels.some((label) =>
        /kaydet|onayla|geri yükle|İddia ekle|Kaldır/.test(label),
      ),
    ).toBe(false);
    expect(doc.querySelector('textarea')?.hasAttribute('disabled')).toBe(true);
    expect(doc.body.textContent).toContain('İzleyici rolü onay veremez.');
    // Salt okunur görünümde kaynak güvenli bağlantıdır.
    const link = doc.querySelector('a[href="https://example.org/a"]');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('üretimdeki bölümde senaryo kilitlidir', () => {
    const doc = render(
      <EpisodeWorkspace
        canWrite
        detail={episodeDetail({
          status: 'in_production',
          script_approved_at: now,
          script_approved_version: 2,
          script_approved_by: id(5),
        })}
      />,
    );
    expect(doc.body.textContent).toContain(
      'Üretim sürerken senaryo değiştirilemez.',
    );
    expect(doc.querySelector('textarea')?.hasAttribute('disabled')).toBe(true);
    expect(doc.body.textContent).toContain('Sürüm 2');
    expect(doc.body.textContent).toContain(
      'bir ekip üyesi tarafından onaylandı',
    );
  });
});

describe('üretim paneli (render)', () => {
  const button = (doc: Document) =>
    [...doc.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Üretime gönder'),
    );

  it('onaysız senaryoda düğme kapalı ve neden yazılı', () => {
    const doc = render(<ProductionPanel canWrite detail={episodeDetail({})} />);
    expect(button(doc)?.hasAttribute('disabled')).toBe(true);
    expect(doc.body.textContent).toContain('Onaylı senaryo gerekli');
    expect(doc.body.textContent).toContain('Üretim makinesi bağlı değil');
  });

  it('onaylı senaryoda makine olmasa da gönderilebilir; iş ve aşamaları listelenir', () => {
    const detail = episodeDetail({ status: 'script_approved' });
    detail.jobs = [
      {
        id: id(7),
        kind: 'explainer.render',
        status: 'queued',
        progress: 0,
        current_stage: null,
        stop_at: null,
        error: null,
        failed_stage: null,
        episode_script_version: 2,
        required_capabilities: ['voice.edge-tts'],
        cancel_requested_at: null,
        created_at: now,
        finished_at: null,
        stages: ['voice', 'captions', 'visuals', 'render'].map((key, i) => ({
          seq: i + 1,
          key,
          status: 'pending',
          progress: 0,
          detail: null,
          error: null,
          requires_approval: key === 'render',
          approved_at: null,
        })),
      },
    ] as EpisodeDetail['jobs'];
    const doc = render(<ProductionPanel canWrite detail={detail} />);
    expect(button(doc)?.hasAttribute('disabled')).toBe(false);
    const text = doc.body.textContent ?? '';
    expect(text).toContain('Sırada');
    expect(text).toContain('1. Seslendirme');
    expect(text).toContain('4. Render ve video onayı');
    expect(text).toContain('onay ister');
    expect(text).toContain('İşi iptal et');
  });

  it('viewer üretime gönderemez', () => {
    const doc = render(
      <ProductionPanel
        canWrite={false}
        detail={episodeDetail({ status: 'script_approved' })}
      />,
    );
    expect(button(doc)).toBeUndefined();
  });
});

describe('kaynak bağlantısı (render)', () => {
  it('http(s) dışındaki adres bağlantı olmaz, metin olarak görünür', () => {
    const doc = render(
      <ul>
        <li>
          <SourceLink
            source={{ title: 'Zararlı', url: 'javascript:alert(1)' }}
          />
        </li>
        <li>
          <SourceLink source={{ url: 'https://example.org/rapor' }} />
        </li>
      </ul>,
    );
    const links = [...doc.querySelectorAll('a')];
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('https://example.org/rapor');
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(doc.body.textContent).toContain('Zararlı');
  });
});

describe('konu önerileri (render)', () => {
  const detail: TopicRequestDetail = {
    request: {
      id: id(1),
      workspace_id: id(9),
      series_id: null,
      prompt: 'Havacılık',
      kind: null,
      language: 'tr',
      created_at: now,
      updated_at: now,
      created_by: null,
    },
    series: null,
    suggestions: [
      {
        id: id(2),
        workspace_id: id(9),
        request_id: id(1),
        series_id: null,
        position: 1,
        title: 'Planör <b>nasıl</b> uçar',
        title_key: 'planor nasil ucar',
        summary: 'Özet',
        hook: 'Motor yok',
        visual_idea: 'Kanat kesiti',
        kind: 'how_it_works',
        evidence_level: 'proven',
        evidence_detail: { views: 120000, median: 30000 },
        source_candidates: [
          { title: 'Kötü', url: 'javascript:alert(1)' },
          { title: 'İyi', url: 'https://example.org' },
        ],
        sensitivity_note: null,
        status: 'rejected',
        decided_by: null,
        decided_at: now,
        rejection_reason: 'Çok genel',
        created_at: now,
        updated_at: now,
        created_by: null,
        episodeId: null,
      },
    ],
  };

  it('kart alanlarını, kanıt düzeyini ve güvenli kaynak bağlantılarını gösterir', () => {
    const doc = render(<Suggestions canWrite detail={detail} />);
    const text = doc.body.textContent ?? '';
    expect(text).toContain('Planör <b>nasıl</b> uçar');
    expect(doc.querySelector('b')).toBeNull();
    expect(text).toContain('Kanıt: Kanıtlı');
    expect(text).toContain('İzlenme: 120000');
    expect(text).toContain('Elenme nedeni');
    expect(text).toContain('Yine de seç');
    expect(
      [...doc.querySelectorAll('article a')].map((a) => a.getAttribute('href')),
    ).toEqual(['https://example.org/']);
    // AI girişi yerinde ama kapalı.
    const ai = [...doc.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Yapay zekâdan öneri iste'),
    );
    expect(ai?.hasAttribute('disabled')).toBe(true);
  });

  it('viewer seçemez, eleyemez, ekleyemez', () => {
    const doc = render(<Suggestions canWrite={false} detail={detail} />);
    expect(doc.querySelectorAll('button')).toHaveLength(0);
    expect(doc.querySelectorAll('form')).toHaveLength(0);
  });
});
