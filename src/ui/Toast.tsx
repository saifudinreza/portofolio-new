import { useAchievements } from '../game/achievements';

/** Small corner announcement when an achievement unlocks. The live region is always mounted so screen readers pick it up. */
export function Toast() {
  const toast = useAchievements((s) => s.toast);
  const note = useAchievements((s) => s.note);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
          <span className="toast-star" aria-hidden>★</span>
          <span>
            <b>Achievement unlocked</b>
            <span className="toast-title">{toast.title}</span>
          </span>
        </div>
      )}
      {!toast && note && (
        <div className="toast" key={note}>
          <span className="toast-star" aria-hidden>✦</span>
          <span className="toast-title">{note}</span>
        </div>
      )}
    </div>
  );
}
