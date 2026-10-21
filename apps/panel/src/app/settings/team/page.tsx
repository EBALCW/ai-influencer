import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { MailPlus, ShieldCheck, UsersRound } from 'lucide-react';
import type { TeamRole } from '@ai-influencer/shared';
import { authMessages } from '@/lib/auth-messages';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
} from './actions';

export const dynamic = 'force-dynamic';

const roleLabels: Record<TeamRole, string> = {
  owner: authMessages.teamRoleOwner,
  editor: authMessages.teamRoleEditor,
  viewer: authMessages.teamRoleViewer,
};

const resultMessages: Record<string, string> = {
  invited: authMessages.inviteSuccess,
  'role-updated': authMessages.roleSuccess,
  removed: authMessages.removeSuccess,
  error: authMessages.actionFailed,
  'service-key': authMessages.serviceKeyMissing,
};

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await connection();
  const { result } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: claimsResult } = await supabase.auth.getClaims();
  const userId = claimsResult?.claims?.sub;
  if (!userId) redirect('/login');

  const { data: currentMember, error: currentMemberError } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (currentMemberError || !currentMember) redirect('/access-denied');

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('user_id, role, created_at')
    .order('created_at', { ascending: true });
  if (membersError) redirect('/access-denied?reason=check');

  const admin = createSupabaseAdminClient();
  const emailByUserId = new Map<string, string>();
  if (admin) {
    const { data: userList } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    userList?.users.forEach((user) => {
      if (user.email) emailByUserId.set(user.id, user.email);
    });
  }

  const resultMessage = result ? resultMessages[result] : null;
  const isOwner = currentMember.role === 'owner';

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-9 text-text sm:px-8">
      <header className="mb-7">
        <p className="text-[10px] font-bold tracking-[0.17em] text-accent">
          YÖNETİM
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          {authMessages.teamTitle}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {authMessages.teamDescription}
        </p>
      </header>

      {resultMessage ? (
        <p
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${result === 'error' || result === 'service-key' ? 'border-accent/25 bg-accent/5 text-accent-strong' : 'border-mint/20 bg-mint/5 text-mint'}`}
          role="status"
        >
          {resultMessage}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line-soft bg-surface">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
              <UsersRound size={17} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-text">
                Erişim listesi
              </h2>
              <p className="mt-1 text-xs text-subtle">{members.length} üye</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/5 px-2.5 py-1 text-[10px] text-mint">
            <ShieldCheck size={12} /> RLS etkin
          </span>
        </div>

        {members.length ? (
          <div className="divide-y divide-line-soft">
            {members.map((member) => {
              const memberEmail = emailByUserId.get(member.user_id);
              const isCurrentUser = member.user_id === userId;
              return (
                <article
                  key={member.user_id}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {memberEmail ?? member.user_id}
                    </p>
                    <p className="mt-1 text-[11px] text-subtle">
                      {isCurrentUser
                        ? authMessages.currentUser
                        : `Üye kimliği: ${member.user_id.slice(0, 8)}`}
                    </p>
                  </div>
                  <span className="min-w-28 text-xs text-muted">
                    {roleLabels[member.role]}
                    {isCurrentUser ? ` · ${authMessages.currentUser}` : ''}
                  </span>
                  {isOwner && !isCurrentUser ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <form
                        action={updateTeamMemberRole}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="userId"
                          value={member.user_id}
                        />
                        <label
                          className="sr-only"
                          htmlFor={`role-${member.user_id}`}
                        >
                          {authMessages.teamRole}
                        </label>
                        <select
                          id={`role-${member.user_id}`}
                          name="role"
                          defaultValue={member.role}
                          className="h-9 rounded-lg border border-line bg-surface-raised px-2 text-xs text-text"
                        >
                          <option value="owner">
                            {authMessages.teamRoleOwner}
                          </option>
                          <option value="editor">
                            {authMessages.teamRoleEditor}
                          </option>
                          <option value="viewer">
                            {authMessages.teamRoleViewer}
                          </option>
                        </select>
                        <button
                          className="h-9 rounded-lg border border-line px-3 text-xs text-muted hover:bg-surface-raised"
                          type="submit"
                        >
                          {authMessages.updateRole}
                        </button>
                      </form>
                      <form action={removeTeamMember}>
                        <input
                          type="hidden"
                          name="userId"
                          value={member.user_id}
                        />
                        <button
                          className="h-9 rounded-lg border border-rose-500/20 px-3 text-xs text-rose-500 hover:bg-rose-500/10"
                          type="submit"
                        >
                          {authMessages.removeMember}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-subtle">
            {authMessages.noMembers}
          </p>
        )}
      </section>

      {isOwner ? (
        <section className="mt-5 rounded-2xl border border-line-soft bg-surface p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
              <MailPlus size={17} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-text">
                {authMessages.inviteTitle}
              </h2>
              <p className="mt-1 text-xs text-subtle">
                Davet edilen kullanıcı hesabına erişmek için e-posta
                bağlantısını kullanır.
              </p>
            </div>
          </div>
          {admin ? (
            <form
              action={inviteTeamMember}
              className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
            >
              <label className="grid gap-2 text-xs text-muted">
                {authMessages.teamEmail}
                <input
                  className="h-10 rounded-lg border border-line bg-surface-raised px-3 text-sm text-text outline-none placeholder:text-subtle focus:border-accent/50"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="ad@ornek.com"
                  required
                />
              </label>
              <label className="grid gap-2 text-xs text-muted">
                {authMessages.teamRole}
                <select
                  className="h-10 rounded-lg border border-line bg-surface-raised px-3 text-sm text-text"
                  name="role"
                  defaultValue="viewer"
                >
                  <option value="owner">{authMessages.teamRoleOwner}</option>
                  <option value="editor">{authMessages.teamRoleEditor}</option>
                  <option value="viewer">{authMessages.teamRoleViewer}</option>
                </select>
              </label>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-xs font-semibold text-canvas hover:bg-accent-strong"
                type="submit"
              >
                <MailPlus size={14} />
                {authMessages.invite}
              </button>
            </form>
          ) : (
            <p className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-xs leading-5 text-accent-strong">
              {authMessages.serviceKeyMissing}
            </p>
          )}
        </section>
      ) : (
        <p className="mt-5 rounded-xl border border-line-soft bg-surface-raised px-4 py-3 text-xs text-muted">
          {authMessages.ownerOnly}
        </p>
      )}
    </div>
  );
}
