// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { isSameOrigin } from './same-origin';

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
    ['bozuk origin', { origin: 'adres değil' }],
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
