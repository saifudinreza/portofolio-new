import { useEffect, useRef } from 'react'
import anime from 'animejs'
import imgBooking     from '../assets/booking.png'
import imgMarketplace from '../assets/marketplace.png'

const projects = [
  {
    id: 1,
    year: '2025',
    title: 'RentWheels',
    subtitle: 'Vehicle Booking Platform',
    initials: 'RW',
    gradient: 'from-indigo-800/60 to-blue-800/30',
    preview: imgBooking,
    description:
      'Full-featured vehicle rental platform with 4-step booking flow, payment integration (OVO/GoPay/DANA, bank transfer, Alfamart/Indomaret), KTP/SIM document verification, and complete transaction history.',
    tags: ['HTML5', 'CSS3', 'JavaScript', 'Vercel'],
    live: 'https://projek-booking-sewa.vercel.app/',
    github: null,
  },
  {
    id: 2,
    year: '2025',
    title: 'Marketplace App',
    subtitle: 'Full-Stack E-Commerce Platform',
    initials: 'MKT',
    gradient: 'from-emerald-800/60 to-teal-800/30',
    preview: imgMarketplace,
    description:
      'Fullstack marketplace with Laravel REST API backend. User authentication, product & category CRUD, and buy-sell transaction flow. React frontend deployed on Vercel.',
    tags: ['React', 'Laravel', 'PHP', 'MySQL', 'REST API', 'Vercel'],
    live: 'https://marketplace-app-ten-rosy.vercel.app/',
    github: 'https://github.com/saifudinreza/marketplace-api',
  },
  {
    id: 3,
    year: '2024',
    title: 'Todo App',
    subtitle: 'Task Management',
    initials: 'TODO',
    gradient: 'from-violet-800/60 to-purple-800/30',
    description:
      'Clean task management web app. Real-time task creation, completion toggling, and deletion. Built with Laravel Blade template engine.',
    tags: ['Laravel', 'Blade', 'PHP', 'MySQL'],
    live: null,
    github: 'https://github.com/saifudinreza/todo-app-project',
  },
  {
    id: 4,
    year: '2024',
    title: 'Marketplace API',
    subtitle: 'RESTful Backend Service',
    initials: 'API',
    gradient: 'from-orange-800/60 to-amber-800/30',
    description:
      'Production-ready REST API with JWT authentication, product/category management endpoints, and input validation. Clean, structured Laravel architecture.',
    tags: ['Laravel', 'PHP', 'MySQL', 'REST API', 'JWT Auth'],
    live: null,
    github: 'https://github.com/saifudinreza/marketplace-api',
  },
]

function ProjectCard({ project }) {
  return (
    <div
      className="project-card rounded-2xl border border-neutral-800 overflow-hidden hover:border-neutral-700 transition-all duration-300 group bg-neutral-900/20"
      style={{ opacity: 0 }}
    >
      {/* Preview area */}
      <div className="relative h-44 overflow-hidden">
        {project.preview ? (
          <>
            <img
              src={project.preview}
              alt={project.title}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
            />
            {/* Gradient overlay agar konten badge tetap terbaca */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#111]/80 via-transparent to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${project.gradient} flex items-end p-4`}>
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '20px 20px',
              }}
            />
            <span className="text-white/10 text-4xl font-bold font-mono select-none relative z-10">
              {project.initials}
            </span>
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          {project.live && (
            <span className="px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-mono flex items-center gap-1 backdrop-blur-sm">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse inline-block" />
              live
            </span>
          )}
          <span className="px-2 py-1 text-[10px] bg-neutral-900/60 text-neutral-500 border border-neutral-700/40 rounded-full font-mono backdrop-blur-sm">
            {project.year}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="mb-3">
          <h3 className="text-white font-semibold text-base group-hover:text-indigo-300 transition-colors leading-tight">
            {project.title}
          </h3>
          <p className="text-neutral-600 text-xs font-mono mt-0.5">{project.subtitle}</p>
        </div>

        <p className="text-neutral-500 text-sm leading-relaxed mb-4">
          {project.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-md bg-neutral-800/80 text-neutral-500 font-mono border border-neutral-700/30"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {project.live && (
            <a
              href={project.live}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 text-center text-xs font-medium bg-indigo-600/15 border border-indigo-600/30 text-indigo-400 rounded-lg hover:bg-indigo-600/25 hover:border-indigo-500/50 transition-all duration-200"
            >
              Live Demo ↗
            </a>
          )}
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className={`${project.live ? '' : 'flex-1'} px-4 py-2 text-center text-xs font-medium bg-neutral-800/60 border border-neutral-700/50 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-neutral-300 transition-all duration-200`}
            >
              GitHub ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProjectsSection() {
  const sectionRef  = useRef()
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          anime({
            targets: sectionRef.current?.querySelectorAll('.project-card'),
            opacity: [0, 1],
            translateY: [32, 0],
            duration: 900,
            delay: anime.stagger(100),
            easing: 'easeOutExpo',
          })
        }
      },
      { threshold: 0.05 },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="projects"
      ref={sectionRef}
      className="py-28 max-w-6xl mx-auto px-6 lg:px-8"
    >
      <div className="mb-14">
        <h2 className="text-3xl font-bold text-white">
          <span className="text-indigo-400 mr-1">/</span>projects
        </h2>
        <p className="text-neutral-500 mt-2 text-sm">
          Things I've built and shipped to production.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      <div className="mt-10 text-center">
        <a
          href="https://github.com/saifudinreza"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-300 text-sm transition-colors group"
        >
          <span>View all 29+ repositories on GitHub</span>
          <span className="group-hover:translate-x-1 transition-transform duration-200 inline-block">→</span>
        </a>
      </div>
    </section>
  )
}
