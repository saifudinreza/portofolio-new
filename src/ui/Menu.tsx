import type { ReactNode } from 'react';
import { input, useStore, type MenuTab } from '../store';
import { profile } from '../data/profile';
import { QualitySelect, SoundControl } from './Hud';
import { useDialogFocus } from './useDialog';

const TABS: { id: MenuTab; label: string }[] = [
  { id: 'options', label: 'Options' },
  { id: 'controls', label: 'Controls' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'about-site', label: 'Behind the scene' },
];

const REPO_URL = 'https://github.com/saifudinreza/portofolio-new';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="menu-row">
      <span className="menu-label">{label}</span>
      {children}
    </div>
  );
}

function OptionsPanel() {
  const setMenu = useStore((s) => s.setMenu);
  return (
    <>
      <Row label="Sound"><SoundControl /></Row>
      <Row label="Graphics"><QualitySelect /></Row>
      <Row label="Stuck?">
        <button
          className="btn small"
          onClick={() => {
            input.respawnNearestRequested = true;
            setMenu(null);
          }}
        >
          I'm stuck: respawn at the nearest area
        </button>
      </Row>
      <Row label="World">
        <button className="btn small" onClick={() => window.location.reload()}>Reset the world</button>
      </Row>
    </>
  );
}

function Keys({ rows }: { rows: [keys: string[], action: string][] }) {
  return (
    <table className="menu-table">
      <tbody>
        {rows.map(([keys, action]) => (
          <tr key={action}>
            <th scope="row">{keys.map((k) => <kbd key={k}>{k}</kbd>)}</th>
            <td>{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ControlsPanel() {
  return (
    <>
      <h3>Keyboard and mouse</h3>
      <Keys
        rows={[
          [['W', 'A', 'S', 'D'], 'Drive (arrow keys work too)'],
          [['Shift'], 'Boost'],
          [['Space'], 'Jump'],
          [['B', 'Ctrl'], 'Brake'],
          [['H'], 'Horn (hold)'],
          [['R'], "Respawn at the nearest area (I'm stuck)"],
          [['Enter'], 'Open the project you are parked on'],
          [['M'], 'Big map'],
          [['L'], 'Mute'],
          [['Esc'], 'Close this panel'],
          [['Drag'], 'Turn the camera'],
          [['Scroll'], 'Zoom'],
        ]}
      />
      <h3>Phone and tablet</h3>
      <Keys
        rows={[
          [['Stick'], 'Drive and steer (switch to arrow buttons with the Buttons toggle)'],
          [['⚡'], 'Boost'],
          [['▲'], 'Jump'],
          [['Horn'], 'Horn'],
          [["I'm stuck"], 'Respawn at the nearest area'],
        ]}
      />
      <h3>Gamepad</h3>
      <Keys
        rows={[
          [['Left stick'], 'Steer'],
          [['RT'], 'Gas'],
          [['LT'], 'Reverse'],
          [['A'], 'Jump'],
          [['B'], 'Brake'],
          [['X'], 'Boost'],
          [['Y'], 'Open the project you are parked on'],
          [['RB'], 'Horn'],
          [['Back'], 'Respawn at the nearest area'],
        ]}
      />
    </>
  );
}

function AchievementsPanel() {
  return <p className="muted">Achievements are coming soon.</p>;
}

function AboutSitePanel() {
  return (
    <>
      <p>
        Zare World is the portfolio of {profile.name}: a small island you explore by driving a jeep. Concept inspired by{' '}
        <a href="https://bruno-simon.com" target="_blank" rel="noopener noreferrer">bruno-simon.com</a>.
      </p>
      <h3>Built with</h3>
      <ul className="menu-list">
        <li>Vite, React 19 and TypeScript</li>
        <li>three.js through React Three Fiber and drei</li>
        <li>Rapier physics (WebAssembly)</li>
        <li>Zustand for the UI state</li>
        <li>Models, textures and sounds all made in code, with no asset files</li>
      </ul>
      <h3>Credits</h3>
      <ul className="menu-list">
        <li>Fonts: Archivo Black and DM Sans (SIL Open Font License)</li>
      </ul>
      <p>
        <a className="btn small repo" href={REPO_URL} target="_blank" rel="noopener noreferrer">Source code on GitHub</a>
      </p>
    </>
  );
}

/** The ☰ panel: options, controls, achievements and credits. Esc or a click outside closes it. */
export function Menu() {
  const tab = useStore((s) => s.menuOpen);
  const setMenu = useStore((s) => s.setMenu);
  const panel = useDialogFocus<HTMLDivElement>(tab !== null);
  if (!tab) return null;

  return (
    <div className="menu-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setMenu(null)}>
      <div className="menu" role="dialog" aria-modal="true" aria-label="Menu" ref={panel} tabIndex={-1}>
        <div className="menu-head">
          <div role="tablist" aria-label="Menu sections" className="menu-tabs">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setMenu(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="menu-close" aria-label="Close menu" onClick={() => setMenu(null)}>✕</button>
        </div>
        <div className="menu-body" role="tabpanel">
          {tab === 'options' && <OptionsPanel />}
          {tab === 'controls' && <ControlsPanel />}
          {tab === 'achievements' && <AchievementsPanel />}
          {tab === 'about-site' && <AboutSitePanel />}
        </div>
      </div>
    </div>
  );
}
