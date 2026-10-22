import { describe, expect, it } from 'vitest';
import { Constants } from '@ai-influencer/shared';
import {
  buildGenerationParams,
  generationOptionsSchema,
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
      seed: '',
      testMode: true,
      inputAssetIds: [],
      overrideBudget: false,
    });
    expect(ok).toEqual({
      resolution: '720p',
      testMode: true,
      inputAssetIds: [],
      overrideBudget: false,
    });
    for (const bad of [
      { resolution: '4k' },
      { durationSeconds: '0' },
      { durationSeconds: '61' },
      { seed: '-1' },
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

  it('test mode forces 480p in params', () => {
    const params = buildGenerationParams({
      prompt: 'p',
      negative: '',
      variables: {},
      promptVersion: 1,
      options: {
        resolution: '1080p',
        testMode: true,
        durationSeconds: 8,
        inputAssetIds: [],
        overrideBudget: false,
      },
    });
    expect(params).toMatchObject({
      resolution: '480p',
      test_mode: true,
      duration_seconds: 8,
    });
    expect(params).not.toHaveProperty('seed');
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
