import type { Repositories } from './repositories';

type StorageLike = Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>;

/**
 * Ask for persistent storage once, on first launch, and record the answer in `persistGranted`.
 * Later launches only re-read the current state (iOS may grant it after install).
 */
export async function ensurePersistence(repos: Repositories, storage: StorageLike | undefined): Promise<boolean | null> {
  if (!storage?.persist) {
    await repos.settings.set('persistGranted', null);
    return null;
  }
  const asked = await repos.settings.get<boolean | null>('persistGranted');
  const granted = asked === undefined ? await storage.persist() : await storage.persisted();
  await repos.settings.set('persistGranted', granted);
  return granted;
}

export interface StorageStatus {
  supported: boolean;
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

export async function readStorageStatus(storage: StorageLike | undefined): Promise<StorageStatus> {
  if (!storage) return { supported: false, persisted: null, usage: null, quota: null };
  const [persisted, est] = await Promise.all([
    storage.persisted ? storage.persisted() : Promise.resolve(null),
    storage.estimate ? storage.estimate() : Promise.resolve(undefined),
  ]);
  return { supported: true, persisted, usage: est?.usage ?? null, quota: est?.quota ?? null };
}
