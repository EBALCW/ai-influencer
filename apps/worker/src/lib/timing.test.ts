import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  backoffMs,
  clampLeaseSeconds,
  clampProgress,
  leaseExpired,
  leaseRenewIntervalMs,
  refreshAtMs,
} from './timing.ts';

test('kira süresi veritabanı sınırlarına çekilir', () => {
  assert.equal(clampLeaseSeconds(5), 30);
  assert.equal(clampLeaseSeconds(120), 120);
  assert.equal(clampLeaseSeconds(5000), 900);
  assert.equal(clampLeaseSeconds(Number.NaN), 120);
});

test('kira sürenin üçte birinde yenilenir', () => {
  assert.equal(leaseRenewIntervalMs(120), 40_000);
  assert.equal(leaseRenewIntervalMs(30), 10_000);
  assert.equal(leaseRenewIntervalMs(1), 10_000); // 30 sn'ye çekilir
});

test('leaseExpired: bitiş, pay ve bozuk değer', () => {
  const now = Date.parse('2026-11-16T10:00:00Z');
  assert.equal(leaseExpired('2026-11-16T10:02:00Z', now), false);
  assert.equal(leaseExpired('2026-11-16T10:00:00Z', now), true);
  assert.equal(leaseExpired('2026-11-16T10:00:20Z', now, 30_000), true);
  assert.equal(leaseExpired(null, now), true);
  assert.equal(leaseExpired('bozuk', now), true);
});

test('backoff: üstel, sınırlı, titreşimli', () => {
  const low = { random: () => 0 };
  const high = { random: () => 1 };
  assert.equal(backoffMs(1, low), 500);
  assert.equal(backoffMs(1, high), 1000);
  assert.equal(backoffMs(3, high), 4000);
  assert.equal(backoffMs(30, high), 60_000);
  assert.equal(backoffMs(30, low), 30_000);
  assert.equal(backoffMs(0, high), 1000);
  assert.equal(backoffMs(2, { baseMs: 200, maxMs: 300, random: () => 1 }), 300);
  for (let attempt = 1; attempt < 12; attempt++) {
    const value = backoffMs(attempt);
    assert.ok(value >= 500 && value <= 60_000);
  }
});

test('token ömrünün sonuna doğru yenilenir', () => {
  const issued = 1_000_000;
  // 1 saatlik token: son 5 dakikada
  assert.equal(refreshAtMs(issued, issued + 3_600_000), issued + 3_300_000);
  // 60 saniyelik token: son beşte birinde
  assert.equal(refreshAtMs(issued, issued + 60_000), issued + 48_000);
  // çok kısa ömür: en az 5 sn pay
  assert.equal(refreshAtMs(issued, issued + 10_000), issued + 5000);
});

test('ilerleme 0..100 tamsayıya çekilir', () => {
  assert.equal(clampProgress(-3), 0);
  assert.equal(clampProgress(41.6), 42);
  assert.equal(clampProgress(250), 100);
  assert.equal(clampProgress(Number.NaN), 0);
});
