import { dismissToast, showToast, useToast } from './toast';

/** Confirmation toast above the tab bar. Never blocks; Undo is one tap. */
export function Toast() {
  const toast = useToast();
  if (!toast) return null;
  const { undo } = toast;
  return (
    <div className="banner toast" role="status" key={toast.id}>
      <span className="grow">{toast.message}</span>
      {undo && (
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() => {
            dismissToast();
            undo().then(
              () => showToast('Undone'),
              () => showToast('Could not undo'),
            );
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
