import { join } from 'node:path';

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
    '-f',
    join(directory, 'data-auth.sql'),
    '-f',
    join(directory, 'data-public.sql'),
  ];
}
