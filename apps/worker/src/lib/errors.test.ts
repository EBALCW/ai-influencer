import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import {
  AbortedError,
  ApiError,
  NetworkError,
  PermanentError,
  SessionError,
  TransientError,
  classifyRpcFailure,
  isRetryableApiFailure,
  isRetryableStageError,
} from './errors.ts';

const api = (status: number, code?: string, hint?: string) =>
  new ApiError('x', { status, code: code ?? null, hint: hint ?? null });

test('geçici API hataları: ağ, 5xx, 429, 408', () => {
  assert.equal(isRetryableApiFailure(new NetworkError('x')), true);
  assert.equal(isRetryableApiFailure(api(503)), true);
  assert.equal(isRetryableApiFailure(api(429)), true);
  assert.equal(isRetryableApiFailure(api(408)), true);
  assert.equal(isRetryableApiFailure(api(400, '22023')), false);
  assert.equal(isRetryableApiFailure(new Error('x')), false);
});

test('RPC hatası makine davranışına çevrilir', () => {
  assert.equal(classifyRpcFailure(new NetworkError('x')), 'retry');
  assert.equal(classifyRpcFailure(api(502)), 'retry');
  assert.equal(
    classifyRpcFailure(api(400, '55000', 'lease_lost')),
    'lease_lost',
  );
  assert.equal(
    classifyRpcFailure(api(400, '55000', 'cancel_requested')),
    'cancel_requested',
  );
  assert.equal(
    classifyRpcFailure(api(403, '42501', 'worker_revoked')),
    'revoked',
  );
  assert.equal(
    classifyRpcFailure(api(403, '42501', 'worker_session_required')),
    'revoked',
  );
  assert.equal(classifyRpcFailure(api(403, '42501')), 'revoked');
  assert.equal(classifyRpcFailure(api(401)), 'revoked');
  assert.equal(classifyRpcFailure(new SessionError('x')), 'revoked');
  assert.equal(classifyRpcFailure(api(400, 'P0002')), 'lease_lost');
  assert.equal(
    classifyRpcFailure(api(400, '55000', 'illegal_transition')),
    'lease_lost',
  );
  assert.equal(classifyRpcFailure(api(400, '22023')), 'fatal');
  assert.equal(classifyRpcFailure(new Error('x')), 'fatal');
});

test('aşama hatası: kalıcı mı, yeniden denenebilir mi', () => {
  assert.equal(isRetryableStageError(new PermanentError('x')), false);
  assert.equal(isRetryableStageError(new TransientError('x')), true);
  assert.equal(isRetryableStageError(new Error('beklenmeyen')), true);
  assert.equal(isRetryableStageError(new AbortedError('x')), true);
  const parsed = z.object({ a: z.number() }).safeParse({ a: 'x' });
  assert.equal(parsed.success, false);
  assert.equal(isRetryableStageError(parsed.error), false);
});
