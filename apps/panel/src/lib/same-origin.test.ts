// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { isCrossOriginApiMutation, isSameOrigin } from './same-origin';

function request(url: string, headers: Record<string, string>) {
  return new NextRequest(url, { method: 'POST', headers });
}

describe('isSameOrigin', () => {
  it('kendi origin’inden gelen isteği kabul eder', () => {
    expect(
      isSameOrigin(
        request('https://panel.ornek.com/api/x', {
          origin: 'https://panel.ornek.com',
          host: 'panel.ornek.com',
        }),
      ),
    ).toBe(true);
  });

  it('sunucu localhost görürken tarayıcı 127.0.0.1 kullanıyorsa Host ile eşleşir', () => {
    expect(
      isSameOrigin(
        request('http://localhost:3000/api/x', {
          origin: 'http://127.0.0.1:3000',
          host: '127.0.0.1:3000',
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ['Origin yok', {}],
    ['başka site', { origin: 'https://example.invalid' }],
    ['aynı ad, başka port', { origin: 'http://127.0.0.1:4000' }],
    ['alt alan adı', { origin: 'http://kotu.127.0.0.1:3000' }],
    ['null origin', { origin: 'null' }],
    ['bozuk origin', { origin: 'adres-degil' }],
    ['başka şema', { origin: 'file://127.0.0.1:3000' }],
  ])('reddeder: %s', (_name, headers) => {
    expect(
      isSameOrigin(
        request('http://localhost:3000/api/x', {
          host: '127.0.0.1:3000',
          ...headers,
        }),
      ),
    ).toBe(false);
  });
});

describe('isCrossOriginApiMutation', () => {
  const make = (
    url: string,
    method: string,
    headers: Record<string, string> = {},
  ) => new NextRequest(url, { method, headers });
  const own = { origin: 'https://panel.ornek.com', host: 'panel.ornek.com' };

  it('başka siteden ya da Origin’siz değiştirici API isteğini reddeder', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      for (const headers of [
        { origin: 'https://example.invalid', host: 'panel.ornek.com' },
        { host: 'panel.ornek.com' },
        { origin: 'null', host: 'panel.ornek.com' },
      ] as Record<string, string>[])
        expect(
          isCrossOriginApiMutation(
            make('https://panel.ornek.com/api/clips/1', method, headers),
          ),
          `${method} ${JSON.stringify(headers)}`,
        ).toBe(true);
  });

  it('kendi origin’inden gelen isteği, okuma isteklerini ve API dışı yolları engellemez', () => {
    expect(
      isCrossOriginApiMutation(
        make('https://panel.ornek.com/api/explainers/series', 'POST', own),
      ),
    ).toBe(false);
    for (const method of ['GET', 'HEAD', 'OPTIONS'])
      expect(
        isCrossOriginApiMutation(
          make('https://panel.ornek.com/api/oauth/youtube/callback', method),
        ),
      ).toBe(false);
    expect(
      isCrossOriginApiMutation(
        make('https://panel.ornek.com/auth/signout', 'POST'),
      ),
    ).toBe(false);
  });
});
