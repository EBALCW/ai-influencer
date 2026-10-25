import { describe, expect, it } from 'vitest';
import { Constants } from '@ai-influencer/shared';
import {
  buildGenerationParams,
  costLabel,
  type GenerationMode,
  type GenerationOptions,
  generationOptionsSchema,
  modeFields,
  inputRequirementError,
  modeForCategory,
  queueError,
  statusLabels,
  typeForMode,
  workerNotice,
} from './generation-queue';
import { generationTypeForCategory } from './prompt-schemas';

describe('generation queue helpers', () => {
  it('every DB status has a label', () => {
    expect(Object.keys(statusLabels).sort()).toEqual(
      [...Constants.public.Enums.generation_status].sort(),
    );
  });

  it('category mode agrees with the generation type', () => {
    for (const [category, mode] of Object.entries(modeForCategory)) {
      const type =
        generationTypeForCategory[category as keyof typeof modeForCategory];
      expect(mode ? typeForMode[mode] : null).toBe(type);
    }
  });

  it('options default to safe values and reject bad input', () => {
    const ok = generationOptionsSchema.parse({
      durationSeconds: '',
      testMode: true,
      inputAssetIds: [],
      overrideBudget: false,
    });
    expect(ok).toEqual({
      resolution: '720p',
      imageResolution: '2K',
      aspectRatio: '9:16',
      testMode: true,
      inputAssetIds: [],
      overrideBudget: false,
    });
    expect(
      generationOptionsSchema.parse({
        durationSeconds: '10',
        testMode: false,
        inputAssetIds: [],
        overrideBudget: false,
      }).durationSeconds,
    ).toBe(10);
    for (const bad of [
      { resolution: '4k' },
      { imageResolution: '8K' },
      { aspectRatio: '7:3' },
      // Kling 5|10; serbest süre sağlayıcıda reddedilir
      { durationSeconds: '6' },
      { durationSeconds: '0' },
      { inputAssetIds: ['x'] },
    ])
      expect(
        generationOptionsSchema.safeParse({
          testMode: false,
          inputAssetIds: [],
          overrideBudget: false,
          ...bad,
        }).success,
      ).toBe(false);
  });

  const options = (extra: Partial<GenerationOptions> = {}) => ({
    resolution: '1080p' as const,
    imageResolution: '4K' as const,
    aspectRatio: '4:5' as const,
    testMode: true,
    durationSeconds: 10 as number | undefined,
    inputAssetIds: [],
    overrideBudget: false,
    ...extra,
  });
  const build = (
    mode: GenerationMode,
    extra: Partial<GenerationOptions> = {},
  ) =>
    buildGenerationParams({
      mode,
      prompt: 'p',
      negative: 'n',
      variables: {},
      promptVersion: 1,
      options: options(extra),
    });

  it('writes only the fields the mode supports', () => {
    const image = build('text_to_image', { testMode: false });
    expect(image).toMatchObject({
      image_resolution: '4K',
      aspect_ratio: '4:5',
    });
    for (const key of ['resolution', 'duration_seconds', 'seed'])
      expect(image).not.toHaveProperty(key);

    const i2v = build('image_to_video', { testMode: false });
    expect(i2v).toMatchObject({ duration_seconds: 10 });
    for (const key of ['resolution', 'image_resolution', 'aspect_ratio'])
      expect(i2v).not.toHaveProperty(key);

    const v2v = build('video_to_video', { testMode: false });
    expect(v2v).toMatchObject({ resolution: '1080p' });
    for (const key of ['duration_seconds', 'image_resolution'])
      expect(v2v).not.toHaveProperty(key);
  });

  it('test mode forces the cheapest values per mode', () => {
    expect(build('text_to_image')).toMatchObject({
      test_mode: true,
      image_resolution: '2K',
    });
    expect(build('image_to_video')).toMatchObject({ duration_seconds: 5 });
    expect(build('video_to_video')).toMatchObject({ resolution: '480p' });
    expect(
      build('image_to_video', { testMode: false, durationSeconds: undefined }),
    ).toMatchObject({ duration_seconds: 5 });
  });

  it('form fields per mode hide unsupported provider fields', () => {
    expect(modeFields.text_to_image).toEqual({
      resolution: false,
      image: true,
      duration: false,
    });
    expect(modeFields.image_to_video.resolution).toBe(false);
    expect(modeFields.video_to_video.duration).toBe(false);
  });

  it('checks reference files per mode', () => {
    expect(inputRequirementError('text_to_image', [])).toBeNull();
    expect(inputRequirementError('image_to_video', [])).toMatch(/görsel/);
    expect(inputRequirementError('image_to_video', ['image/png'])).toBeNull();
    expect(
      inputRequirementError('video_to_video', ['image/png']),
    ).not.toBeNull();
    expect(
      inputRequirementError('video_to_video', ['video/mp4', 'image/png']),
    ).toBeNull();
  });

  it('cost label prefers the actual USD cost, then the estimate', () => {
    expect(
      costLabel({
        status: 'succeeded',
        cost_usd: 0.094,
        estimated_cost_usd: 0.1,
      }),
    ).toBe('$0.094');
    expect(
      costLabel({
        status: 'running',
        cost_usd: null,
        estimated_cost_usd: '2.5',
      }),
    ).toBe('≈ $2.50 (tahmini)');
    expect(
      costLabel({ status: 'failed', cost_usd: null, estimated_cost_usd: 0.2 }),
    ).toBeNull();
    expect(
      costLabel({ status: 'queued', cost_usd: null, estimated_cost_usd: null }),
    ).toBeNull();
  });

  it('maps queue errors', () => {
    expect(
      queueError({ code: 'P0001', message: '', hint: 'budget_exceeded' })
        .status,
    ).toBe(402);
    expect(queueError({ code: 'P0001', message: '' }).status).toBe(500);
  });

  it('worker notice: unconfigured provider, never ran, stale', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    expect(workerNotice(null, false, now)).toBeNull();
    expect(workerNotice(null, true, now)).toMatch(/henüz çalışmadı/);
    expect(
      workerNotice(
        { last_run_at: '2026-10-22T11:59:00Z', providers: [], message: null },
        true,
        now,
      ),
    ).toMatch(/yapılandırılmamış/);
    expect(
      workerNotice(
        {
          last_run_at: '2026-10-22T11:00:00Z',
          providers: ['higgsfield'],
          message: null,
        },
        true,
        now,
      ),
    ).toMatch(/10 dakikadır/);
    expect(
      workerNotice(
        {
          last_run_at: '2026-10-22T11:59:00Z',
          providers: ['higgsfield'],
          message: null,
        },
        true,
        now,
      ),
    ).toBeNull();
  });
});
