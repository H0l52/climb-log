import { useEffect, useRef, useState } from 'react';
import type { ID } from '../../db/types';
import { usePhotoUrl } from './usePhotoUrl';

/** Full-screen photo. Tap anywhere or "Close" (in the thumb zone) to go back. */
export function PhotoViewer({ photoId, label, onClose }: { photoId: ID; label: string; onClose: () => void }) {
  const url = usePhotoUrl(photoId, 'blob');
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      {url ? <img src={url} alt={label} /> : <p className="muted">Loading photo…</p>}
      <button ref={close} type="button" className="btn photo-viewer-close" onClick={onClose}>Close</button>
    </div>
  );
}

/** Square thumbnail that opens the full photo on tap. Renders nothing when the problem has no photo. */
export function PhotoThumb({ photoId, label }: { photoId: ID | null; label: string }) {
  const url = usePhotoUrl(photoId, 'thumb');
  const [open, setOpen] = useState(false);
  if (!photoId || !url) return null;
  return (
    <>
      <button type="button" className="photo-thumb" aria-label={`Show photo: ${label}`} onClick={() => setOpen(true)}>
        <img src={url} alt="" />
      </button>
      {open && <PhotoViewer photoId={photoId} label={label} onClose={() => setOpen(false)} />}
    </>
  );
}
