import { useEffect, useRef } from "react";
import anime from "animejs";

const bentoItems = [
  {
    id: 1,
    colSpan: "md:col-span-2",
    icon: "👨‍💻",
    title: "Tentang Saya",
    content:
      "Mahasiswa Sistem Informasi semester 8 yang sedang dalam perjalanan menjadi fullstack developer profesional. Di balik kesibukan sehari-hari, saya terus menulis kode — karena saya percaya konsistensi mengalahkan kesempurnaan. Setiap proyek adalah bukti bahwa latar belakang bukan penghalang untuk mimpi yang lebih besar.",
  },
  {
    id: 2,
    colSpan: "md:col-span-1",
    icon: "🛠️",
    title: "Tech Stack",
    content: "React · Laravel · JavaScript · PHP · MySQL · HTML · CSS · Git",
  },
  {
    id: 3,
    colSpan: "md:col-span-1",
    icon: "🎓",
    title: "Pendidikan",
    content: "S1 Sistem Informasi — Semester 8",
  },
  {
    id: 4,
    colSpan: "md:col-span-1",
    icon: "📍",
    title: "Lokasi",
    content: "Indonesia 🇮🇩 — Remote Friendly",
  },
  {
    id: 5,
    colSpan: "md:col-span-1",
    icon: "✅",
    title: "Status",
    content: "Open to Work — Freelance & Full-time",
  },
  {
    id: 6,
    colSpan: "md:col-span-3",
    icon: "🚀",
    title: "Apa yang Saya Bangun",
    content:
      "Saya fokus pada fullstack development — membangun REST API dengan Laravel di backend dan antarmuka interaktif dengan React di frontend. Sudah membuat 29+ repositori publik, dari CRUD sederhana hingga platform booking dan marketplace yang deployed ke production.",
  },
];

function useScrollAnimation(ref, animationFn) {
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animationFn();
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
}

export default function AboutSection() {
  const sectionRef = useRef();

  useScrollAnimation(sectionRef, () => {
    anime({
      targets: sectionRef.current?.querySelectorAll(".bento-card"),
      opacity: [0, 1],
      translateY: [28, 0],
      duration: 900,
      delay: anime.stagger(90),
      easing: "easeOutExpo",
    });
  });

  return (
    <section
      id="about"
      ref={sectionRef}
      className="py-28 max-w-6xl mx-auto px-6 lg:px-8"
    >
      <div className="mb-14">
        <h2 className="text-3xl font-bold text-white">
          <span className="text-indigo-400 mr-1">/</span>about
        </h2>
        <p className="text-neutral-500 mt-2 text-sm">
          Siapa saya di balik layar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bentoItems.map((item) => (
          <div
            key={item.id}
            className={`bento-card ${item.colSpan} p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm hover:border-indigo-800/50 hover:bg-neutral-900/70 transition-all duration-300 group`}
            style={{ opacity: 0 }}
          >
            <span className="text-2xl mb-4 block">{item.icon}</span>
            <h3 className="text-white font-semibold text-sm mb-2 group-hover:text-indigo-300 transition-colors duration-300">
              {item.title}
            </h3>
            <p className="text-neutral-500 text-sm leading-relaxed">
              {item.content}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
