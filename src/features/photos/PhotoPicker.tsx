import { useState } from 'react';
import type { PhotoInput } from '../../db/photos';
import { processImage } from './processImage';
import { useObjectUrl } from './usePhotoUrl';

/**
 * "Take photo" opens the camera (capture), "Choose photo" the library. The image is downscaled right away,
 * outside any transaction, and handed up ready to store.
 */
export function PhotoPicker({ value, onChange, replacing = false }: { value: PhotoInput | null; onChange: (p: PhotoInput | null) => void; replacing?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useObjectUrl(value?.thumb);

  async function pick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await processImage(file));
    } catch {
      setError('Could not read that photo. Try another one.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <span className="muted" id="photo-h">Photo{replacing && ' (replaces the current one)'}</span>
      {value && preview ? (
        <div className="row">
          <img className="photo-preview" src={preview} alt="Photo to save" />
          <span className="grow muted">Saved with the climb</span>
          <button type="button" className="btn btn-small" onClick={() => onChange(null)}>Remove photo</button>
        </div>
      ) : (
        <div className="row" role="group" aria-labelledby="photo-h">
          <label className="btn grow file-btn">
            Take photo
            <input type="file" accept="image/*" capture="environment" className="visually-hidden" disabled={busy} onChange={(e) => void pick(e.currentTarget)} />
          </label>
          <label className="btn grow file-btn">
            Choose photo
            <input type="file" accept="image/*" className="visually-hidden" disabled={busy} onChange={(e) => void pick(e.currentTarget)} />
          </label>
        </div>
      )}
      {busy && <p className="muted" role="status">Preparing photo…</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
