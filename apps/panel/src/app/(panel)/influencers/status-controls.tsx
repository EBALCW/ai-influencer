'use client';

import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui';
import { updateInfluencerStatus } from './actions';

export function StatusControls({
  id,
  status,
  canEdit,
}: {
  id: string;
  status: string;
  canEdit: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [nextStatus, setNextStatus] = useState('');
  if (!canEdit) return null;
  const label =
    nextStatus === 'archived'
      ? 'Arşivle'
      : nextStatus === 'paused'
        ? 'Duraklat'
        : 'Yeniden etkinleştir';
  return (
    <>
      <form
        action={updateInfluencerStatus}
        ref={formRef}
        className="flex flex-wrap gap-2"
      >
        <input name="id" type="hidden" value={id} />
        <input name="status" type="hidden" value={nextStatus} />
        {status === 'active' ? (
          <>
            <button
              className="button button-quiet"
              onClick={() => setNextStatus('paused')}
              type="button"
            >
              Duraklat
            </button>
            <button
              className="button button-quiet"
              onClick={() => setNextStatus('archived')}
              type="button"
            >
              Arşivle
            </button>
          </>
        ) : status === 'archived' ? (
          <button
            className="button button-quiet"
            onClick={() => setNextStatus('active')}
            type="button"
          >
            Arşivden çıkar
          </button>
        ) : (
          <>
            <button
              className="button button-primary"
              onClick={() => setNextStatus('active')}
              type="button"
            >
              Etkinleştir
            </button>
            <button
              className="button button-quiet"
              onClick={() => setNextStatus('archived')}
              type="button"
            >
              Arşivle
            </button>
          </>
        )}
      </form>
      <ConfirmDialog
        open={Boolean(nextStatus)}
        title={`${label}?`}
        description={
          nextStatus === 'archived'
            ? 'Kayıt listeden kaldırılacak; verileri kalıcı olarak silinmeyecek.'
            : 'Influencer durumu güncellenecek.'
        }
        confirmLabel={label}
        onCancel={() => setNextStatus('')}
        onConfirm={() => {
          setNextStatus('');
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
