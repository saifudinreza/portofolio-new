import { useEffect, useState } from 'react';
import { useStore, type Spot } from '../store';
import { certifications, education, experience, profile, projects, skillGroups } from '../data/profile';
import { ProjectCover, ProjectLinks } from './ProjectBits';
import { reducedMotion } from './device';

const contactCopy = {
  github: { title: 'GitHub', body: 'Source code for KasirAI, KostKu, TrustPay and more.', cta: 'Open github.com/saifudinreza' },
  linkedin: { title: 'LinkedIn', body: "Let's connect. I'm open to junior software engineer roles.", cta: 'Open LinkedIn profile' },
  email: { title: 'Email', body: profile.email, cta: 'Send me an email' },
};

const EXIT_MS = 220;

/**
 * The card for whatever the car is parked on. It slides in, and when the car drives off it stays for a
 * moment to slide out instead of blinking away.
 */
export function SpotCard() {
  const spot = useStore((s) => s.spot);
  const [prevSpot, setPrevSpot] = useState<Spot | null>(spot);
  const [shown, setShown] = useState<Spot | null>(spot);
  const [leaving, setLeaving] = useState(false);

  // React to the spot changing while rendering (no extra effect pass): show the new one, or start leaving.
  if (spot !== prevSpot) {
    setPrevSpot(spot);
    if (spot) {
      setShown(spot);
      setLeaving(false);
    } else {
      setLeaving(true);
    }
  }

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, reducedMotion() ? 0 : EXIT_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);

  if (!shown) return null;
  return (
    <aside className={`card${leaving ? ' leaving' : ''}`} key={JSON.stringify(shown)} aria-live="polite">
      {shown.kind === 'project' && <ProjectCard id={shown.id} />}
      {shown.kind === 'skills' && (
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
      {shown.kind === 'about' && (
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
      {shown.kind === 'contact' && (
        <>
          <p className="eyebrow">Say hello</p>
          <h2>{contactCopy[shown.id].title}</h2>
          <p>{contactCopy[shown.id].body}</p>
          <div className="actions">
            <a className="btn primary big" href={profile.links[shown.id]} target="_blank" rel="noreferrer">{contactCopy[shown.id].cta}</a>
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
      <ProjectCover project={p} />
      <p className="eyebrow">{p.badge ?? 'Project'} · {p.year}</p>
      <h2>{p.name}</h2>
      <p className="lead">{p.tagline}</p>
      {p.links.length > 0 ? (
        <>
          <ProjectLinks project={p} />
          <p className="hint">Press <kbd>Enter</kbd> to open the first link</p>
        </>
      ) : (
        <p className="hint">Case study available on request.</p>
      )}
      <ul className="bullets">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
      <ul className="chips">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
    </>
  );
}
