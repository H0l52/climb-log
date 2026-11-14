import type { ClimbDB } from './schema';
import type { Clock } from './repositories';
import type { ID, Photo } from './types';
import { melbourneDate } from '../domain/dates';
import { orphanPhotos, photosPastRetention, retentionDays } from '../domain/photos';

/** A processed photo ready to store (image work happens before any transaction). */
export interface PhotoInput {
  blob: Blob;
  thumb: Blob;
}

export function createPhotoRepositories(db: ClimbDB, clock: Clock) {
  return {
    get: (id: ID): Promise<Photo | undefined> => db.photos.get(id),

    /**
     * Delete photos of problems on sets retired more than `photoRetentionDays` ago (default 90), and photos no
     * problem refers to any more. The problems are kept; only `photoId` is cleared. Returns how many were removed.
     */
    async applyRetention(): Promise<number> {
      return db.transaction('rw', [db.photos, db.problems, db.wallSets, db.settings], async () => {
        const days = retentionDays((await db.settings.get('photoRetentionDays'))?.value);
        const withPhoto = await db.problems.filter((p) => p.photoId !== null).toArray();
        const sets = await db.wallSets.bulkGet([...new Set(withPhoto.map((p) => p.wallSetId))]);
        const expired = photosPastRetention(withPhoto, sets.filter((s) => s !== undefined), melbourneDate(clock.now()), days);
        for (const { problemId } of expired) await db.problems.update(problemId, { photoId: null });
        const kept = withPhoto.filter((p) => !expired.some((e) => e.problemId === p.id));
        // Blobs in IndexedDB are references, so reading the rows does not load the image bytes.
        const orphans = orphanPhotos(await db.photos.toArray(), kept, clock.now());
        const remove = [...new Set([...expired.map((e) => e.photoId), ...orphans])];
        await db.photos.bulkDelete(remove);
        return remove.length;
      });
    },

    /** Number of stored photos and the bytes they take (full + thumbnail). */
    async usage(): Promise<{ count: number; bytes: number }> {
      let count = 0;
      let bytes = 0;
      await db.photos.each((p) => {
        count += 1;
        bytes += p.blob.size + p.thumb.size;
      });
      return { count, bytes };
    },
  };
}
