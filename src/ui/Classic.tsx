import { useStore } from '../store';
import { certifications, education, experience, profile, projects, skillGroups } from '../data/profile';
import { ProjectCover, ProjectLinks } from './ProjectBits';

const SECTIONS = [
  ['projects', 'Projects'],
  ['skills', 'Skills'],
  ['about', 'About'],
  ['experience', 'Experience'],
] as const;

/** The whole portfolio as a normal, scrollable page. For recruiters in a hurry and devices without WebGL. */
export function Classic({ webglMissing = false }: { webglMissing?: boolean }) {
  const setClassic = useStore((s) => s.setClassic);
  return (
    <div className="classic" role="dialog" aria-modal="true" aria-label="Classic portfolio view">
      <nav className="classic-nav" aria-label="Sections">
        <span className="logo">SR</span>
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        {!webglMissing && <button className="btn small primary" onClick={() => setClassic(false)}>Back to 3D</button>}
      </nav>
      <div className="classic-inner">
        <header className="classic-hero">
          <p className="eyebrow">Portfolio · 2026</p>
          <h1>{profile.name}</h1>
          <p className="lead">{profile.role}</p>
          <p className="muted">{profile.location}</p>
          <div className="actions">
            <a className="btn primary" href={profile.links.email}>Email me</a>
            <a className="btn" href={profile.links.github} target="_blank" rel="noreferrer">GitHub</a>
            <a className="btn" href={profile.links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </header>

        <section id="projects">
          <h2>Projects</h2>
          <div className="grid">
            {projects.map((p) => (
              <article key={p.id} className="tile" style={{ ['--accent' as string]: p.color }}>
                <ProjectCover project={p} />
                <p className="eyebrow">{p.badge ?? 'Project'} · {p.year}</p>
                <h3>{p.name}</h3>
                <p className="lead">{p.tagline}</p>
                <ul className="bullets">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                <ul className="chips">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
                {p.links.length > 0 && <ProjectLinks project={p} />}
              </article>
            ))}
          </div>
        </section>

        <section id="skills">
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

        <section id="about">
          <h2>About</h2>
          <p className="about-text">{profile.summary}</p>
        </section>

        <section id="experience" className="two-col">
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
