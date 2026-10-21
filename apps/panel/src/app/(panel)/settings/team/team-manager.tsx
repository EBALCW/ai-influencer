'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { TeamRole } from '@ai-influencer/shared';

type Member = {
  userId: string;
  email: string;
  role: TeamRole;
  createdAt: string;
};
const roles: TeamRole[] = ['owner', 'editor', 'viewer'];

export function TeamManager({ currentUserId }: { currentUserId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('viewer');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/team', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? 'Ekip listesi alınamadı.');
    setMembers(result.members);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/team', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? 'Ekip listesi alınamadı.');
        if (active) setMembers(result.members);
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : 'Ekip listesi alınamadı.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Davet gönderilemedi.');
      setEmail('');
      setMessage('Davet e-postası gönderildi.');
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Davet gönderilemedi.',
      );
    } finally {
      setPending(false);
    }
  }

  async function updateRole(member: Member, nextRole: TeamRole) {
    setMessage('');
    const response = await fetch(`/api/team/${member.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? 'Rol değiştirilemedi.');
      return;
    }
    await refresh();
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`${member.email} ekipten çıkarılsın mı?`)) return;
    setMessage('');
    const response = await fetch(`/api/team/${member.userId}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? 'Üye çıkarılamadı.');
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={invite}
        className="grid gap-3 rounded-2xl border border-white/[0.08] bg-black/10 p-4 sm:grid-cols-[1fr_150px_auto] sm:items-end"
      >
        <label className="block text-xs font-medium text-slate-300">
          E-posta adresi
          <input
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-mint/60"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="uye@ekip.com"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Rol
          <select
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-3 text-sm text-white outline-none focus:border-mint/60"
            value={role}
            onChange={(event) => setRole(event.target.value as TeamRole)}
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
          disabled={pending}
        >
          {pending ? 'Gönderiliyor…' : 'Davet et'}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-sm font-semibold">
          Ekip üyeleri{' '}
          <span className="font-normal text-slate-500">{members.length}</span>
        </h2>
        <div className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-4 px-4 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-100">
                  {member.email}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Üyelik:{' '}
                  {new Date(member.createdAt).toLocaleDateString('tr-TR')}
                </p>
              </div>
              {member.userId === currentUserId ? (
                <span className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs capitalize text-slate-400">
                  {member.role} · sen
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`${member.email} rolü`}
                    className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
                    value={member.role}
                    onChange={(event) =>
                      updateRole(member, event.target.value as TeamRole)
                    }
                  >
                    {roles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-lg border border-red-300/20 px-3 py-2 text-xs text-red-200 hover:bg-red-300/10"
                    type="button"
                    onClick={() => removeMember(member)}
                  >
                    Çıkar
                  </button>
                </div>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">
              Henüz ekip üyesi yok.
            </p>
          )}
        </div>
      </div>
      {message && (
        <p aria-live="polite" className="text-sm text-mint">
          {message}
        </p>
      )}
    </div>
  );
}
