import { join } from 'node:path';

/** Geri yüklenen veri dosyaları, yükleme sırasıyla (auth.users önce: public FK'leri ona bağlı). */
export const RESTORE_FILES = ['data-auth.sql', 'data-public.sql'];

/** Libpq ortamı doğrulanmış localhost hedefini (özellikle PGHOSTADDR ile) değiştirmesin. */
export function restoreEnvironment(environment, connectionEnvironment) {
  const inherited = Object.fromEntries(
    Object.entries(environment).filter(([name]) => !/^PG/i.test(name)),
  );
  return {
    ...inherited,
    ...connectionEnvironment,
    PGOPTIONS: '-c session_replication_role=replica',
  };
}

/** A single psql session wraps destructive cleanup and both imports atomically. */
export function restorePsqlArgs(connectionArgs, directory) {
  return [
    ...connectionArgs,
    '-X',
    '--single-transaction',
    '-v',
    'ON_ERROR_STOP=1',
    '--quiet',
    '-c',
    "do $$ declare r record; begin for r in select tablename from pg_tables where schemaname = 'public' loop execute format('truncate table public.%I cascade', r.tablename); end loop; end $$; delete from auth.identities; delete from auth.users;",
    ...RESTORE_FILES.flatMap((file) => ['-f', join(directory, file)]),
  ];
}
