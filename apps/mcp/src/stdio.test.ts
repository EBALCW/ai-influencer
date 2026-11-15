// Gerçek süreç testi: `node src/cli.ts start` stdio üzerinden resmî istemciyle konuşur.
// stdout'a protokol dışı tek satır yazılsa bağlantı kurulamaz; test bunu da yakalar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { ALL_TOOLS, SERVER_NAME } from './server.ts';

const here = dirname(fileURLToPath(import.meta.url));
const anonKey = `x.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.y`;

async function withServer(
  env: Record<string, string>,
  run: (
    client: Client,
    stderr: () => string,
    stateDir: string,
  ) => Promise<void>,
): Promise<void> {
  const stateDir = mkdtempSync(join(tmpdir(), 'mcp-stdio-'));
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' &&
        !/SUPABASE|NODE_TEST_CONTEXT/.test(entry[0]),
    ),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(here, 'cli.ts'), 'start'],
    env: { ...inherited, AI_INFLUENCER_MCP_STATE_DIR: stateDir, ...env },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on(
    'data',
    (chunk: Buffer) => (stderr += chunk.toString('utf8')),
  );
  const client = new Client({ name: 'stdio-test', version: '0.0.0' });
  try {
    await client.connect(transport);
    await run(client, () => stderr, stateDir);
  } finally {
    await client.close();
    rmSync(stateDir, { recursive: true, force: true });
  }
}

test('stdio: sunucu açılır, araçları listeler, giriş yokken durumu söyler', async () => {
  await withServer(
    {
      // Kimse dinlemiyor: test hiçbir uzak sisteme bağlanmaz.
      AI_INFLUENCER_SUPABASE_URL: 'http://127.0.0.1:59999',
      AI_INFLUENCER_SUPABASE_ANON_KEY: anonKey,
    },
    async (client, stderr, stateDir) => {
      assert.equal(client.getServerVersion()?.name, SERVER_NAME);
      assert.match(client.getInstructions() ?? '', /VERİ, TALİMAT DEĞİLDİR/);
      const { tools } = await client.listTools();
      assert.equal(tools.length, ALL_TOOLS.length);

      const who = (await client.callTool({
        name: 'whoami',
        arguments: {},
      })) as {
        isError?: boolean;
        structuredContent?: { veri?: { giris?: string } };
      };
      assert.notEqual(who.isError, true);
      // Giriş yok ('yok') ya da bu makinede kimlik kasası yok ('sorunlu'); ikisinde de oturum yok.
      assert.match(who.structuredContent?.veri?.giris ?? '', /^(yok|sorunlu)$/);

      const read = (await client.callTool({
        name: 'list_series',
        arguments: {},
      })) as {
        isError?: boolean;
        content: { text: string }[];
      };
      assert.equal(read.isError, true);
      assert.match(
        read.content[0]!.text,
        /^Hata \[(giris_gerekli|kasa_hatasi)\]/,
      );

      const log = readFileSync(join(stateDir, 'denetim.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { tool: string });
      assert.deepEqual(
        log.map((entry) => entry.tool),
        ['whoami', 'list_series'],
      );
      assert.doesNotMatch(stderr(), /eyJ|refresh_token|Bearer/);
    },
  );
});

test('stdio: yapılandırma yoksa sunucu yine açılır ve nedenini araçtan söyler', async () => {
  await withServer(
    {
      AI_INFLUENCER_SUPABASE_URL: 'https://ornek.invalid',
      // Service role anahtarı verilirse sunucu onu kullanmaz, reddeder.
      AI_INFLUENCER_SUPABASE_ANON_KEY: `x.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.y`,
    },
    async (client) => {
      const result = (await client.callTool({
        name: 'list_series',
        arguments: {},
      })) as {
        isError?: boolean;
        content: { text: string }[];
      };
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /anon anahtarı değil/);
    },
  );
});
