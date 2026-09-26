import { useStore } from '../store';
import { certifications, education, experience, profile, projects, skillGroups } from '../data/profile';

const contactCopy = {
  github: { title: 'GitHub', body: 'Source code for KasirAI, KostKu, TrustPay and more.', cta: 'Open github.com/saifudinreza' },
  linkedin: { title: 'LinkedIn', body: "Let's connect. I'm open to junior software engineer roles.", cta: 'Open LinkedIn profile' },
  email: { title: 'Email', body: profile.email, cta: 'Send me an email' },
};

export function SpotCard() {
  const spot = useStore((s) => s.spot);
  if (!spot) return null;

  return (
    <aside className="card" key={JSON.stringify(spot)} aria-live="polite">
      {spot.kind === 'project' && <ProjectCard id={spot.id} />}
      {spot.kind === 'skills' && (
        <>
          <p className="eyebrow">The warehouse</p>
          <h2>Skills</h2>
          {skillGroups.map((g) => (
            <div key={g.title} className="group">
              <h3>{g.title}</h3>
              <ul className="chips">{g.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </>
      )}
      {spot.kind === 'about' && (
        <>
          <p className="eyebrow">About me</p>
          <h2>{profile.name}</h2>
          <p>{profile.summary}</p>
          <h3>Education</h3>
          <ul className="list">{education.map((e) => <li key={e.title}><b>{e.title}</b><span>{e.place}{e.detail && ` · ${e.detail}`}</span></li>)}</ul>
          <h3>Certifications</h3>
          <ul className="list">{certifications.map((c) => <li key={c.title}><b>{c.title}</b><span>{c.issuer} · {c.detail}</span></li>)}</ul>
          <h3>Work</h3>
          <ul className="list">{experience.map((e) => <li key={e.title}><b>{e.title}</b><span>{e.place} · {e.period}</span></li>)}</ul>
        </>
      )}
      {spot.kind === 'contact' && (
        <>
          <p className="eyebrow">Say hello</p>
          <h2>{contactCopy[spot.id].title}</h2>
          <p>{contactCopy[spot.id].body}</p>
          <div className="actions">
            <a className="btn primary" href={profile.links[spot.id]} target="_blank" rel="noreferrer">{contactCopy[spot.id].cta}</a>
          </div>
          <p className="hint">Press <kbd>Enter</kbd> to open</p>
        </>
      )}
    </aside>
  );
}

function ProjectCard({ id }: { id: string }) {
  const p = projects.find((x) => x.id === id);
  if (!p) return null;
  return (
    <>
      <p className="eyebrow" style={{ color: p.color }}>{p.badge ?? 'Project'} · {p.year}</p>
      <h2>{p.name}</h2>
      <p className="lead">{p.tagline}</p>
      <ul className="bullets">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
      <ul className="chips">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
      {p.links.length > 0 ? (
        <>
          <div className="actions">
            {p.links.map((l, i) => (
              <a key={l.href} className={`btn ${i === 0 ? 'primary' : ''}`} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
            ))}
          </div>
          <p className="hint">Press <kbd>Enter</kbd> to open</p>
        </>
      ) : (
        <p className="hint">Case study available on request.</p>
      )}
    </>
  );
}
