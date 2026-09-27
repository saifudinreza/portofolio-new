import type { CSSProperties } from 'react';
import type { Project, ProjectLink } from '../data/profile';

const isRepo = (l: ProjectLink) => /github\.com/.test(l.href);

/** Project thumbnail: the screenshot when there is one, otherwise a cover in the project's colour. */
export function ProjectCover({ project }: { project: Project }) {
  const style = { '--accent': project.color } as CSSProperties;
  if (project.image) {
    return <img className="cover" src={project.image} alt={`${project.name} screenshot`} loading="lazy" style={style} />;
  }
  return (
    <div className="cover" style={style} aria-hidden>
      <span className="cover-mark">{project.name.slice(0, 1)}</span>
      <span className="cover-name">{project.name}</span>
    </div>
  );
}

/** Live site and source links as big, clearly different buttons. */
export function ProjectLinks({ project }: { project: Project }) {
  return (
    <div className="actions project-links">
      {project.links.map((l) =>
        isRepo(l) ? (
          <a key={l.href} className="btn repo" href={l.href} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
            </svg>
            {l.label}
          </a>
        ) : (
          <a key={l.href} className="btn primary big" href={l.href} target="_blank" rel="noreferrer">
            {l.label}
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </a>
        ),
      )}
    </div>
  );
}
