import { useStore } from '../store';
import { certifications, education, experience, profile, projects, skillGroups } from '../data/profile';

/** The whole portfolio as a normal, scrollable page. For recruiters in a hurry and devices without WebGL. */
export function Classic({ webglMissing = false }: { webglMissing?: boolean }) {
  const setClassic = useStore((s) => s.setClassic);
  return (
    <div className="classic" role="dialog" aria-modal="true" aria-label="Classic portfolio view">
      <div className="classic-inner">
        <header className="classic-head">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h1>{profile.name}</h1>
            <p className="lead">{profile.role}</p>
            <p className="muted">{profile.location}</p>
          </div>
          {!webglMissing && <button className="btn primary" onClick={() => setClassic(false)}>Back to the 3D world</button>}
        </header>
        <nav className="classic-links">
          <a href={profile.links.github} target="_blank" rel="noreferrer">GitHub</a>
          <a href={profile.links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          <a href={profile.links.email}>{profile.email}</a>
        </nav>

        <section>
          <h2>About</h2>
          <p>{profile.summary}</p>
        </section>

        <section>
          <h2>Projects</h2>
          <div className="grid">
            {projects.map((p) => (
              <article key={p.id} className="tile" style={{ ['--accent' as string]: p.color }}>
                <p className="eyebrow">{p.badge ?? 'Project'} · {p.year}</p>
                <h3>{p.name}</h3>
                <p className="lead">{p.tagline}</p>
                <ul className="bullets">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                <ul className="chips">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
                <div className="actions">
                  {p.links.map((l, i) => <a key={l.href} className={`btn ${i === 0 ? 'primary' : ''}`} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>)}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>Skills</h2>
          <div className="grid skills">
            {skillGroups.map((g) => (
              <div key={g.title}>
                <h3>{g.title}</h3>
                <ul className="chips">{g.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        <section className="two-col">
          <div>
            <h2>Education</h2>
            <ul className="list">{education.map((e) => <li key={e.title}><b>{e.title}</b><span>{e.place}{e.detail && ` · ${e.detail}`}</span></li>)}</ul>
            <h2>Certifications</h2>
            <ul className="list">{certifications.map((c) => <li key={c.title}><b>{c.title}</b><span>{c.issuer} · {c.detail}</span></li>)}</ul>
          </div>
          <div>
            <h2>Experience</h2>
            <ul className="list">{experience.map((e) => <li key={e.title}><b>{e.title}</b><span>{e.place} · {e.period}</span><span>{e.detail}</span></li>)}</ul>
          </div>
        </section>
        <footer className="muted">Built with React Three Fiber, Rapier physics and Vite.</footer>
      </div>
    </div>
  );
}
