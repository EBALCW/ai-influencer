import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countTests,
  exportedNames,
  routeFromAppPath,
  routeMethods,
  sqlObjects,
} from './codemap-lib.mjs';

describe('routeFromAppPath', () => {
  it('(grup) segmentlerini düşürür', () => {
    assert.equal(
      routeFromAppPath('(panel)/analytics/posts/[postId]/page.tsx'),
      '/analytics/posts/[postId]',
    );
    assert.equal(routeFromAppPath('(panel)/page.tsx'), '/');
    assert.equal(routeFromAppPath('api\\costs\\route.ts'), '/api/costs');
  });
});

describe('routeMethods', () => {
  it('function, const ve liste export', () => {
    const src = `export async function GET() {}\nexport const POST = handler;\nexport { h as PUT };`;
    assert.deepEqual(routeMethods(src), ['GET', 'POST', 'PUT']);
    assert.deepEqual(routeMethods('function GET() {}'), []);
  });
});

describe('exportedNames', () => {
  it('bildirimler, tipler ve yeniden adlandırma', () => {
    const src = `export function a() {}\nexport type B = 1;\nexport { c, d as e, type F };\nexport default function G() {}`;
    assert.deepEqual(
      exportedNames(src).sort(),
      ['B', 'F', 'G', 'a', 'c', 'e'].sort(),
    );
  });
});

describe('sqlObjects', () => {
  it('nesneleri türe göre toplar, yorumları atlar', () => {
    const sql = `-- CREATE TABLE public.ignored (\nCREATE TABLE public.posts (\n);\nCREATE OR REPLACE FUNCTION public.f()\nALTER TABLE x ADD COLUMN IF NOT EXISTS target_hours int;\nSELECT cron.schedule('sync', '*/15 * * * *', $$x$$);`;
    assert.deepEqual(sqlObjects(sql), {
      table: ['posts'],
      function: ['f'],
      column: ['target_hours'],
      cron: ['sync'],
    });
  });
});

describe('countTests', () => {
  it('pgTAP plan toplamı, yoksa test çağrıları', () => {
    assert.equal(
      countTests('SELECT extensions.plan(28);\nSELECT ok(true);'),
      28,
    );
    assert.equal(
      countTests(
        `it('a', () => {});\ntest('b', () => {});\nDeno.test('c', () => {});`,
      ),
      3,
    );
  });
});
