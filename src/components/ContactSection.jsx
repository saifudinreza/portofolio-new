import { useEffect, useRef } from 'react'
import anime from 'animejs'

const socialLinks = [
  {
    label: 'GitHub',
    href: 'https://github.com/saifudinreza',
    description: '29 repositories',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/saifudin-reza-y2003/',
    description: 'Connect with me',
  },
]

export default function ContactSection() {
  const sectionRef = useRef()
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          anime({
            targets: sectionRef.current?.querySelectorAll('.contact-reveal'),
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 1000,
            delay: anime.stagger(120),
            easing: 'easeOutExpo',
          })
        }
      },
      { threshold: 0.2 },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="py-28 border-t border-neutral-800/60"
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className="contact-reveal mb-10" style={{ opacity: 0 }}>
          <h2 className="text-3xl font-bold text-white">
            <span className="text-indigo-400 mr-1">/</span>contact
          </h2>
          <p className="text-neutral-500 mt-2 text-sm max-w-md">
            Tertarik untuk berkolaborasi, menawarkan proyek, atau sekedar ngobrol soal tech?
            Jangan ragu untuk menghubungi saya.
          </p>
        </div>

        {/* Email utama — besar & bold */}
        <div className="contact-reveal mb-16" style={{ opacity: 0 }}>
          <a
            href="mailto:donojomi@gmail.com"
            className="group inline-flex items-center gap-3 text-2xl md:text-4xl font-bold text-white hover:text-indigo-400 transition-colors duration-300 break-all"
          >
            donojomi@gmail.com
            <span className="text-neutral-600 group-hover:text-indigo-400 group-hover:translate-x-1 group-hover:-translate-y-1 inline-block transition-all duration-300 text-3xl">
              ↗
            </span>
          </a>
        </div>

        {/* Social cards */}
        <div
          className="contact-reveal grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16 max-w-lg"
          style={{ opacity: 0 }}
        >
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between p-4 rounded-xl border border-neutral-800 hover:border-indigo-800/60 bg-neutral-900/30 hover:bg-indigo-950/20 transition-all duration-300"
            >
              <div>
                <p className="text-white font-semibold text-sm group-hover:text-indigo-300 transition-colors">
                  {link.label}
                </p>
                <p className="text-neutral-600 text-xs font-mono mt-0.5">
                  {link.description}
                </p>
              </div>
              <span className="text-neutral-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 inline-block transition-all duration-300">
                ↗
              </span>
            </a>
          ))}
        </div>

        {/* Footer bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-8 border-t border-neutral-800/40">
          <p className="contact-reveal text-neutral-600 text-xs font-mono" style={{ opacity: 0 }}>
            Designed & Built by{' '}
            <span className="text-neutral-400">Saifudin Reza</span>
          </p>
          <p className="contact-reveal text-neutral-700 text-xs font-mono" style={{ opacity: 0 }}>
            React · Three.js · Anime.js · Tailwind CSS — © 2025
          </p>
        </div>

      </div>
    </section>
  )
}
