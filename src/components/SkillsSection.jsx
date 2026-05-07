import { useEffect, useRef } from 'react'
import anime from 'animejs'

const categories = [
  {
    id: 'frontend',
    label: 'Frontend',
    accent: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    skills: [
      { name: 'React.js',      level: 4, tag: 'Framework'  },
      { name: 'JavaScript',    level: 4, tag: 'Language'   },
      { name: 'HTML5 / CSS3',  level: 5, tag: 'Core'       },
      { name: 'Tailwind CSS',  level: 4, tag: 'Styling'    },
      { name: 'Three.js',      level: 3, tag: '3D / WebGL' },
    ],
  },
  {
    id: 'backend',
    label: 'Backend',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    skills: [
      { name: 'Laravel',  level: 4, tag: 'Framework'    },
      { name: 'PHP',      level: 4, tag: 'Language'     },
      { name: 'REST API', level: 4, tag: 'Architecture' },
      { name: 'JWT Auth', level: 3, tag: 'Security'     },
    ],
  },
  {
    id: 'tools',
    label: 'Database & Tools',
    accent: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/5',
    skills: [
      { name: 'MySQL',       level: 4, tag: 'Database'       },
      { name: 'Git / GitHub',level: 4, tag: 'Version Control'},
      { name: 'Vercel',      level: 3, tag: 'Deploy'         },
      { name: 'Vite',        level: 3, tag: 'Build Tool'     },
    ],
  },
]

const alsoKnows = ['Bootstrap', 'jQuery', 'Axios', 'Postman', 'Linux CLI', 'Figma (basic)']

function SkillRow({ name, level, tag }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-neutral-800/40 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-neutral-300 text-sm truncate">{name}</span>
        <span className="text-neutral-700 text-[10px] font-mono hidden sm:inline flex-shrink-0">{tag}</span>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {[1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            className={`w-1.5 h-1.5 rounded-full ${dot <= level ? 'bg-indigo-400' : 'bg-neutral-800'}`}
          />
        ))}
      </div>
    </div>
  )
}

export default function SkillsSection() {
  const sectionRef  = useRef()
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          anime({
            targets: sectionRef.current?.querySelectorAll('.skill-cat'),
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 900,
            delay: anime.stagger(110),
            easing: 'easeOutExpo',
          })
          anime({
            targets: sectionRef.current?.querySelector('.also-knows'),
            opacity: [0, 1],
            translateY: [16, 0],
            duration: 700,
            delay: 450,
            easing: 'easeOutExpo',
          })
        }
      },
      { threshold: 0.1 },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="skills"
      ref={sectionRef}
      className="py-28 max-w-6xl mx-auto px-6 lg:px-8"
    >
      <div className="mb-14">
        <h2 className="text-3xl font-bold text-white">
          <span className="text-indigo-400 mr-1">/</span>skills
        </h2>
        <p className="text-neutral-500 mt-2 text-sm">
          Technologies I use to build real products.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`skill-cat p-6 rounded-2xl border ${cat.border} ${cat.bg} backdrop-blur-sm`}
            style={{ opacity: 0 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <span className={`text-xs font-bold font-mono uppercase tracking-widest ${cat.accent}`}>
                {cat.label}
              </span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>
            {cat.skills.map((skill) => (
              <SkillRow key={skill.name} {...skill} />
            ))}
          </div>
        ))}
      </div>

      <div
        className="also-knows mt-5 p-5 rounded-2xl border border-neutral-800/50 bg-neutral-900/20"
        style={{ opacity: 0 }}
      >
        <p className="text-neutral-600 text-[10px] font-mono uppercase tracking-widest mb-3">
          Also familiar with
        </p>
        <div className="flex flex-wrap gap-2">
          {alsoKnows.map((tech) => (
            <span
              key={tech}
              className="px-3 py-1 text-xs rounded-full bg-neutral-800/60 text-neutral-500 border border-neutral-700/40 font-mono"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
