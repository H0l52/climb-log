import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos } from '../../db';
import type { ID } from '../../db/types';

/** Object URL for a blob, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [made, setMade] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setMade({ blob, url }); // eslint-disable-line react-hooks/set-state-in-effect -- the URL must be created and revoked with the effect
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return blob && made?.blob === blob ? made.url : null;
}

/** URL of a stored photo's thumbnail or full image; null when there is none (or it was removed by retention). */
export function usePhotoUrl(photoId: ID | null | undefined, which: 'thumb' | 'blob'): string | null {
  const photo = useLiveQuery(async () => (photoId ? ((await repos.photos.get(photoId)) ?? null) : null), [photoId]);
  return useObjectUrl(photo ? photo[which] : null);
}
