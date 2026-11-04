import { Component, type ReactNode } from 'react';
import { useStore } from '../store';

/**
 * Catches anything that throws while the 3D side renders, including a lazy chunk that failed to download
 * (React rethrows that at render). Instead of a blank page it flips `sceneError`, which shows <SceneError />.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D scene failed', error);
    useStore.getState().setSceneError('crash');
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Full-screen recovery message with a way back to the normal page. Reuses the loader's look. */
export function SceneError() {
  const error = useStore((s) => s.sceneError);
  const setClassic = useStore((s) => s.setClassic);
  const classicOpen = useStore((s) => s.classicOpen);
  // the classic view sits on top of this screen; closing it brings the recovery options back
  if (!error || classicOpen) return null;
  const lost = error === 'context-lost';
  return (
    <div className="loader ready" role="alertdialog" aria-labelledby="scene-error-title">
      <div className="loader-box">
        <h1 id="scene-error-title">{lost ? 'The 3D view was interrupted' : "The 3D world couldn't load"}</h1>
        <p className="muted">
          {lost
            ? 'The browser stopped the graphics card for this page. Reloading usually brings it back.'
            : 'Something went wrong while starting the 3D scene. Reloading usually fixes it, or you can read everything in the classic view.'}
        </p>
        <div className="actions center">
          <button className="btn primary big" onClick={() => window.location.reload()}>Reload</button>
          <button className="btn" onClick={() => setClassic(true)}>Open classic view</button>
        </div>
      </div>
    </div>
  );
}
