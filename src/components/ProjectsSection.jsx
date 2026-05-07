import { useEffect, useRef } from 'react'
import anime from 'animejs'

/**
 * Data proyek nyata Saifudin Reza.
 * Dideskripsikan berdasarkan fitur yang tersedia di production.
 */
const projects = [
  {
    id: 1,
    year: '2025',
    title: 'RentWheels — Platform Booking Kendaraan',
    description:
      'Platform digital pemesanan kendaraan (motor & mobil) untuk wilayah Jakarta. Dilengkapi multi-step booking flow 4 tahap, integrasi berbagai metode pembayaran (e-wallet OVO/GoPay/DANA, transfer bank, minimarket Alfamart/Indomaret), verifikasi dokumen KTP/SIM via upload, dan riwayat transaksi lengkap.',
    tags: ['HTML5', 'CSS3', 'JavaScript', 'Responsive Design'],
    href: 'https://projek-booking-sewa.vercel.app/',
    featured: true,
  },
  {
    id: 2,
    year: '2025',
    title: 'Marketplace App — Platform Jual Beli',
    description:
      'Aplikasi marketplace e-commerce fullstack dengan REST API backend berbasis Laravel. Fitur mencakup autentikasi user (register/login), manajemen kategori & produk (CRUD), serta alur transaksi jual beli. Frontend dibangun dengan JavaScript dan dideploy ke Vercel.',
    tags: ['JavaScript', 'React', 'Laravel', 'PHP', 'MySQL', 'REST API'],
    href: 'https://marketplace-app-ten-rosy.vercel.app/',
    featured: true,
  },
  {
    id: 3,
    year: '2024',
    title: 'Todo App — Task Manager',
    description:
      'Aplikasi manajemen tugas berbasis web dengan antarmuka yang bersih. Mendukung penambahan, penyelesaian, dan penghapusan task secara real-time. Dibangun menggunakan Laravel Blade sebagai template engine.',
    tags: ['Laravel', 'Blade', 'PHP', 'MySQL'],
    href: 'https://github.com/saifudinreza/todo-app-project',
    featured: false,
  },
  {
    id: 4,
    year: '2024',
    title: 'Marketplace API — Backend Service',
    description:
      'RESTful API service untuk ekosistem marketplace. Menyediakan endpoint autentikasi (JWT), manajemen kategori, CRUD produk, dan validasi input. Dibangun dengan Laravel sebagai pondasi backend yang kuat dan terstruktur.',
    tags: ['Laravel', 'PHP', 'MySQL', 'REST API', 'JWT'],
    href: 'https://github.com/saifudinreza/marketplace-api',
    featured: false,
  },
]

/**
 * ProjectCard — hover effect via Anime.js
 * Featured projects memiliki label khusus dan border yang lebih menonjol
 */
function ProjectCard({ project }) {
  const cardRef = useRef()

  const handleMouseEnter = () => {
    anime({
      targets: cardRef.current,
      translateX: 8,
      duration: 300,
      easing: 'easeOutExpo',
    })
  }

  const handleMouseLeave = () => {
    anime({
      targets: cardRef.current,
      translateX: 0,
      duration: 500,
      easing: 'easeOutElastic(1, 0.75)',
    })
  }

  return (
    <a
      href={project.href}
      target="_blank"
      rel="noopener noreferrer"
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`project-card block p-6 border rounded-xl transition-colors duration-300 group cursor-pointer ${
        project.featured
          ? 'border-indigo-900/60 bg-indigo-950/10 hover:border-indigo-700/60 hover:bg-indigo-950/20'
          : 'border-neutral-800 hover:border-neutral-700'
      }`}
      style={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-neutral-600 text-xs font-mono">{project.year}</span>
            {project.featured && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-900/50 text-indigo-400 font-mono border border-indigo-800/50">
                live
              </span>
            )}
          </div>
          <h3 className="text-white font-semibold text-base group-hover:text-indigo-300 transition-colors duration-300 leading-snug">
            {project.title}
          </h3>
        </div>
        <span className="text-neutral-600 group-hover:text-indigo-400 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 inline-block text-xl flex-shrink-0 ml-3">
          ↗
        </span>
      </div>

      {/* Description */}
      <p className="text-neutral-500 text-sm leading-relaxed mb-5">
        {project.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-1 text-xs rounded-md bg-neutral-800/80 text-neutral-400 font-mono border border-neutral-700/50"
          >
            {tag}
          </span>
        ))}
      </div>
    </a>
  )
}

export default function ProjectsSection() {
  const sectionRef = useRef()
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          anime({
            targets: sectionRef.current?.querySelectorAll('.project-card'),
            opacity: [0, 1],
            translateY: [36, 0],
            duration: 900,
            delay: anime.stagger(120),
            easing: 'easeOutExpo',
          })
        }
      },
      { threshold: 0.08 },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const featuredProjects = projects.filter((p) => p.featured)
  const otherProjects    = projects.filter((p) => !p.featured)

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
          Beberapa hal yang sudah saya bangun dan deploy ke production.
        </p>
      </div>

      {/* Featured (live) projects — full width, 2 kolom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {featuredProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {/* Other projects — juga 2 kolom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {otherProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}
