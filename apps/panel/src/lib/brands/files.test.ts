import { describe, expect, it } from 'vitest';
import {
  MAX_CONTRACT_BYTES,
  contractStoragePath,
  displayFileName,
  validateContractFile,
} from './files';

const deal = '10000000-0000-4000-8000-000000000001';

describe('sözleşme dosyaları', () => {
  it('yol deal klasöründe ve uzantı MIME türünden gelir', () => {
    expect(contractStoragePath(deal, 'abc', 'application/pdf')).toBe(
      `${deal}/abc.pdf`,
    );
    expect(() => contractStoragePath(deal, 'abc', 'text/html')).toThrow();
  });

  it('tür ve boyut doğrulanır', () => {
    expect(validateContractFile({ type: 'application/pdf', size: 10 })).toBe(
      null,
    );
    expect(
      validateContractFile({ type: 'application/x-msdownload', size: 10 }),
    ).toMatch(/PDF/);
    expect(validateContractFile({ type: 'application/pdf', size: 0 })).toMatch(
      /boş/,
    );
    expect(
      validateContractFile({
        type: 'application/pdf',
        size: MAX_CONTRACT_BYTES + 1,
      }),
    ).toMatch(/20 MB/);
  });

  it('gösterim adından yol ve kontrol karakterleri temizlenir', () => {
    expect(displayFileName('../../etc/passwd')).toBe('passwd');
    expect(displayFileName('C:\\Users\\x\\sözleşme.pdf')).toBe('sözleşme.pdf');
    expect(displayFileName('a\u0000b.pdf')).toBe('ab.pdf');
    expect(displayFileName('   ')).toBe('dosya');
    expect(displayFileName('x'.repeat(300))).toHaveLength(200);
  });
});
