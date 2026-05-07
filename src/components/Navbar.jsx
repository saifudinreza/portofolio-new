import { useState, useEffect } from 'react'

const navLinks = [
  { label: 'About',    href: '#about'    },
  { label: 'Skills',   href: '#skills'   },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact',  href: '#contact'  },
]

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setMenuOpen(false)

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-800/60'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#hero"
          className="text-white font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
        >
          SR<span className="text-indigo-400">.</span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-neutral-400 hover:text-white transition-colors duration-200 text-sm font-medium"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://www.linkedin.com/in/saifudin-reza-y2003/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 text-sm font-medium text-indigo-300 border border-indigo-500/40 rounded-lg hover:bg-indigo-500/10 hover:border-indigo-400/60 transition-all duration-200"
          >
            Resume ↗
          </a>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-neutral-400 hover:text-white transition-colors"
          aria-label="Toggle navigation"
        >
          <div className="w-5 space-y-1.5">
            <span
              className={`block h-px bg-current transition-all duration-300 origin-center ${
                menuOpen ? 'rotate-45 translate-y-2' : ''
              }`}
            />
            <span
              className={`block h-px bg-current transition-all duration-300 ${
                menuOpen ? 'opacity-0 scale-x-0' : ''
              }`}
            />
            <span
              className={`block h-px bg-current transition-all duration-300 origin-center ${
                menuOpen ? '-rotate-45 -translate-y-2' : ''
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile dropdown */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 bg-[#0a0a0a]/95 backdrop-blur-md ${
          menuOpen ? 'max-h-80 border-b border-neutral-800/60' : 'max-h-0'
        }`}
      >
        <div className="px-6 py-4 space-y-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={close}
              className="flex items-center py-3 text-neutral-400 hover:text-white text-sm font-medium border-b border-neutral-800/30 last:border-0 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2">
            <a
              href="https://www.linkedin.com/in/saifudin-reza-y2003/"
              target="_blank"
              rel="noopener noreferrer"
              className="block py-3 text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors"
            >
              Resume ↗
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
