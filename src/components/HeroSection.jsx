import { useEffect, useRef } from 'react'
import anime from 'animejs'
import ThreeCanvas from './ThreeCanvas'
import profilePhoto from '../assets/profile.jpeg'

/**
 * HeroSection — split layout:
 * Kiri: teks + CTA | Kanan: foto profil dengan aksen indigo
 *
 * Alur Anime.js:
 * 1. Badge role muncul
 * 2. Huruf nama stagger per karakter
 * 3. Tagline & deskripsi fade-in
 * 4. CTA buttons slide up
 * 5. Foto profil slide dari kanan
 */
export default function HeroSection() {
  const badgeRef   = useRef()
  const titleRef   = useRef()
  const taglineRef = useRef()
  const descRef    = useRef()
  const ctaRef     = useRef()
  const statsRef   = useRef()
  const photoRef   = useRef()

  useEffect(() => {
    const tl = anime.timeline({ easing: 'easeOutExpo' })

    tl.add({
      targets: badgeRef.current,
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 700,
    })
    .add(
      {
        targets: titleRef.current?.querySelectorAll('.char'),
        opacity: [0, 1],
        translateY: [36, 0],
        duration: 1000,
        delay: anime.stagger(40),
      },
      '-=400',
    )
    .add(
      {
        targets: taglineRef.current,
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 800,
      },
      '-=700',
    )
    .add(
      {
        targets: descRef.current,
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 800,
      },
      '-=650',
    )
    .add(
      {
        targets: ctaRef.current?.children,
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 700,
        delay: anime.stagger(100),
      },
      '-=600',
    )
    // Foto muncul dari kanan sedikit, bersamaan dengan teks
    .add(
      {
        targets: photoRef.current,
        opacity: [0, 1],
        translateX: [40, 0],
        duration: 1100,
      },
      '-=1400',
    )
    .add({
      targets: statsRef.current,
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 700,
      easing: 'easeOutExpo',
    })
  }, [])

  const nameChars = ['S', 'a', 'i', 'f', 'u', 'd', 'i', 'n', ' ', 'R', 'e', 'z', 'a']

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* ── Three.js latar (absolute, pointer-events: none) ── */}
      <ThreeCanvas />

      {/* ── Konten utama ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-20 w-full">
        <div className="flex items-center justify-between gap-12">

          {/* ── Kolom kiri: teks ── */}
          <div className="flex-1 max-w-xl">

            {/* Badge */}
            <div
              ref={badgeRef}
              style={{ opacity: 0 }}
              className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-indigo-300 text-xs font-medium tracking-widest uppercase">
                Fullstack Developer · Open to Work
              </span>
            </div>

            {/* Nama — stagger per karakter */}
            <h1
              ref={titleRef}
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-3"
              aria-label="Saifudin Reza"
            >
              {nameChars.map((char, i) => (
                <span
                  key={i}
                  className="char inline-block"
                  style={{ opacity: 0 }}
                >
                  {char}
                </span>
              ))}
            </h1>

            {/* Tagline */}
            <p
              ref={taglineRef}
              style={{ opacity: 0 }}
              className="text-indigo-400 font-medium text-base mb-4 tracking-wide"
            >
              "Consistent &gt; Perfect"
            </p>

            {/* Deskripsi */}
            <p
              ref={descRef}
              style={{ opacity: 0 }}
              className="text-neutral-400 text-lg leading-relaxed mb-10"
            >
              Information Systems student building real-world digital products —
              from REST APIs to fullstack apps that actual people use.
            </p>

            {/* CTA */}
            <div ref={ctaRef} className="flex flex-wrap gap-4">
              <a
                href="#projects"
                style={{ opacity: 0 }}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors duration-300"
              >
                View Projects
              </a>
              <a
                href="#contact"
                style={{ opacity: 0 }}
                className="px-8 py-3 border border-neutral-700 hover:border-indigo-600 text-neutral-300 hover:text-white rounded-lg font-medium transition-colors duration-300"
              >
                Get In Touch
              </a>
            </div>

            {/* Stats row */}
            <div
              ref={statsRef}
              style={{ opacity: 0 }}
              className="flex items-center gap-0 mt-10 pt-8 border-t border-neutral-800/40"
            >
              {[
                { value: '4',   label: 'Live Projects'  },
                { value: '29+', label: 'Repositories'   },
                { value: '2+',  label: 'Yrs Coding'     },
              ].map((stat, i) => (
                <div key={stat.label} className="flex items-center">
                  {i > 0 && <div className="w-px h-7 bg-neutral-800 mx-6" />}
                  <div>
                    <div className="text-xl font-bold text-white font-mono tracking-tight">
                      {stat.value}
                    </div>
                    <div className="text-neutral-600 text-xs mt-0.5 font-mono">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Kolom kanan: foto profil ── */}
          <div
            ref={photoRef}
            style={{ opacity: 0 }}
            className="hidden md:flex flex-shrink-0 relative"
          >
            {/* Glow effect di belakang foto */}
            <div className="absolute inset-0 rounded-2xl bg-indigo-600/20 blur-2xl scale-110" />

            {/* Border aksen indigo */}
            <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-indigo-500/40 via-indigo-600/20 to-transparent">
              <img
                src={profilePhoto}
                alt="Saifudin Reza"
                className="w-72 h-96 object-cover object-top rounded-2xl grayscale-[15%]"
              />
              {/* Overlay gradient bawah agar menyatu dengan background */}
              <div className="absolute bottom-0 left-0 right-0 h-24 rounded-b-2xl bg-gradient-to-t from-[#0a0a0a]/60 to-transparent" />
            </div>

            {/* Badge kecil di sudut foto */}
            <div className="absolute -bottom-4 -left-4 bg-[#111] border border-neutral-800 rounded-xl px-4 py-3 shadow-xl">
              <p className="text-neutral-400 text-xs font-mono">
                <span className="text-indigo-400">29</span> repos
              </p>
              <p className="text-white text-sm font-semibold mt-0.5">
                github.com/saifudinreza
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Fade ke section berikutnya */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
        <span className="text-neutral-500 text-xs font-mono tracking-widest">scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-neutral-500 to-transparent" />
      </div>
    </section>
  )
}
