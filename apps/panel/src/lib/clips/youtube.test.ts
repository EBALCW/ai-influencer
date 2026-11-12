import { describe, expect, it } from 'vitest';
import {
  canonicalVideoUrl,
  clipUrl,
  formatTimestamp,
  parseTimestamp,
  parseYouTubeVideoId,
} from './youtube';

describe('parseYouTubeVideoId', () => {
  it('bilinen link biçimlerinden id çıkarır', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=demoClip001',
      'https://youtube.com/watch?v=demoClip001&t=90s',
      'https://m.youtube.com/watch?feature=share&v=demoClip001',
      'https://youtu.be/demoClip001?si=abc',
      'https://www.youtube.com/shorts/demoClip001',
      'https://www.youtube.com/live/demoClip001?feature=share',
      'https://www.youtube.com/embed/demoClip001',
      '  http://www.youtube.com/watch?v=demoClip001  ',
    ])
      expect(parseYouTubeVideoId(url), url).toBe('demoClip001');
    expect(parseYouTubeVideoId('https://youtu.be/a-b_C1234Zz')).toBe(
      'a-b_C1234Zz',
    );
  });

  it('YouTube dışı, eksik veya kötü niyetli linki reddeder', () => {
    for (const url of [
      '',
      'bozuk',
      'javascript:alert(1)',
      'ftp://www.youtube.com/watch?v=demoClip001',
      'https://example.invalid/watch?v=demoClip001',
      'https://youtube.com.evil.example/watch?v=demoClip001',
      'https://notyoutu.be/demoClip001',
      'https://www.youtube.com/watch?v=kisa',
      'https://www.youtube.com/watch?v=demoClip001x',
      'https://www.youtube.com/watch?v=demo<lip001',
      'https://www.youtube.com/@kanal',
      'https://www.youtube.com/playlist?list=demoClip001',
    ])
      expect(parseYouTubeVideoId(url), url).toBeNull();
  });
});

describe('canonicalVideoUrl / clipUrl', () => {
  it('kanonik linki ve başlangıç saniyeli linki üretir', () => {
    const url = canonicalVideoUrl('demoClip001');
    expect(url).toBe('https://www.youtube.com/watch?v=demoClip001');
    expect(clipUrl(url, 90)).toBe(
      'https://www.youtube.com/watch?v=demoClip001&t=90s',
    );
  });
});

describe('parseTimestamp', () => {
  it('ss, mm:ss ve h:mm:ss okur', () => {
    expect(parseTimestamp('45')).toBe(45);
    expect(parseTimestamp('0:00')).toBe(0);
    expect(parseTimestamp('1:30')).toBe(90);
    expect(parseTimestamp(' 12:05 ')).toBe(725);
    expect(parseTimestamp('95:10')).toBe(5710);
    expect(parseTimestamp('1:02:03')).toBe(3723);
  });

  it('geçersiz girişte null döner', () => {
    for (const value of [
      '',
      'abc',
      '1:60',
      '1:75:00',
      '-1',
      '1.5',
      '1:2:3:4',
      ':30',
      '1:',
    ])
      expect(parseTimestamp(value), value).toBeNull();
  });
});

describe('formatTimestamp', () => {
  it('m:ss veya h:mm:ss yazar ve parseTimestamp ile geri okunur', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(90)).toBe('1:30');
    expect(formatTimestamp(725)).toBe('12:05');
    expect(formatTimestamp(3723)).toBe('1:02:03');
    for (const value of [0, 59, 60, 3599, 3600, 86_399])
      expect(parseTimestamp(formatTimestamp(value))).toBe(value);
  });
});
