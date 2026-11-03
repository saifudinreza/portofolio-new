// All portfolio content lives here. Edit this file to update the site,
// no 3D code needs to change.

export type ProjectLink = { label: string; href: string };

export type Project = {
  id: string;
  name: string;
  tagline: string;
  year: string;
  badge?: string;
  color: string;
  stack: string[];
  highlights: string[];
  links: ProjectLink[];
  /** optional screenshot (e.g. '/projects/kasirai.jpg' in public/); without one the card shows a coloured cover */
  image?: string;
  /** which little 3D prop sits on the project pad */
  prop: 'register' | 'house' | 'coins' | 'sofa' | 'key' | 'phone';
};

export const profile = {
  name: 'Saifudin Reza',
  handle: 'zare',
  role: 'Junior Software Engineer · Full Stack Web Developer',
  location: 'Kendal, Central Java, Indonesia',
  email: 'donojomi@gmail.com',
  summary:
    'Full stack developer specializing in Next.js and Laravel, building AI-integrated SaaS. I ship products end-to-end, from schema design and REST APIs to AI integration, payment gateways, and Docker/Nginx deployment. My flagship, KasirAI, is a live multi-tenant SaaS POS platform for Indonesian SMEs with subscription billing, an AI assistant and 346 passing backend tests. I build with AI coding agents like Claude Code while personally owning the critical logic, and I do all of this while working full-time and finishing my Information Systems degree.',
  links: {
    github: 'https://github.com/saifudinreza',
    linkedin: 'https://linkedin.com/in/saifudin-reza-y2003',
    email: 'mailto:donojomi@gmail.com',
  },
};

export const projects: Project[] = [
  {
    id: 'kasirai',
    name: 'KasirAI',
    tagline: 'Multi-tenant AI-powered POS platform',
    year: '2026',
    badge: 'Flagship · Live',
    color: '#2BA89A',
    stack: ['Next.js 14', 'Laravel 11', 'MySQL', 'Groq + OpenRouter', 'Midtrans', 'Cloudflare R2', 'Fonnte WhatsApp', 'Docker', 'Render', 'Vercel'],
    highlights: [
      'Live multi-tenant SaaS POS for Indonesian SMEs: every store is an isolated tenant, enforced by a Laravel global scope',
      'Subscription billing (Free, Pro, Enterprise) and per-tenant Midtrans keys, with separate webhook paths so payments never mix',
      'AI assistant on Groq with an automatic OpenRouter fallback (circuit breaker) when the rate limit hits',
      'Job queue for AI replies and WhatsApp receipts; product photos on Cloudflare R2 served through a backend proxy',
      '346 backend tests (PHPUnit + Pest) and 20/20 end-to-end tests passing; Docker + Nginx + PHP-FPM on Render, frontend on Vercel',
    ],
    links: [
      { label: 'Visit sikasirai.com', href: 'https://sikasirai.com' },
      { label: 'Source code', href: 'https://github.com/saifudinreza/pos-system' },
    ],
    prop: 'register',
  },
  {
    id: 'kostku',
    name: 'KostKu',
    tagline: 'SaaS boarding house management',
    year: '2026',
    color: '#F26B4F',
    stack: ['Next.js 16', 'Laravel', 'PostgreSQL (Neon)', 'Midtrans', 'Groq', 'Fonnte WhatsApp', 'Docker', 'Render', 'Vercel'],
    highlights: [
      'Owners manage properties, rooms, tenancies and one-click monthly invoices; tenants pay online and chat with the owner',
      '40+ REST API endpoints with Sanctum token auth and separate owner and tenant areas',
      'Midtrans Snap payments confirmed by webhook, plus CSV export of invoices and payments',
      'AI-written room descriptions (Groq LLaMA 3.3 70B) and a revenue dashboard with monthly charts',
    ],
    links: [
      { label: 'Visit live app', href: 'https://kostku-app-zeta.vercel.app/' },
      { label: 'Source code', href: 'https://github.com/saifudinreza/kostku-app' },
    ],
    prop: 'house',
  },
  {
    id: 'trustpay',
    name: 'TrustPay',
    tagline: 'Ledger-based digital wallet',
    year: '2026',
    color: '#F5B83D',
    stack: ['React 18 (Vite)', 'Laravel 13', 'PostgreSQL', 'Midtrans', 'Google OAuth', 'Docker', 'Render', 'Vercel'],
    highlights: [
      'E-wallet with peer-to-peer transfers by email, phone or @username, and a full transaction ledger with CSV and print export',
      'Midtrans Snap top-up, QRIS scan and receive, and bill payments, each protected by a required 6-digit PIN',
      'Google OAuth and WhatsApp OTP login on top of Sanctum token auth',
    ],
    links: [
      { label: 'Visit live app', href: 'https://trust-pay-blush.vercel.app' },
      { label: 'Source code', href: 'https://github.com/saifudinreza/TrustPay' },
    ],
    prop: 'coins',
  },
  {
    id: 'loka',
    name: 'Loka Living',
    tagline: 'Furniture e-commerce platform',
    year: '2026',
    badge: 'In development',
    color: '#C68B59',
    stack: ['Next.js 14', 'TypeScript', 'Bun + Elysia', 'PostgreSQL', 'Drizzle ORM', 'Zustand'],
    highlights: [
      'D2C storefront for eco-friendly wood and rattan furniture, built around buyer confidence and a checkout under two minutes',
      'Planned: instant Buy Now, single-screen guest checkout, a 3D / 360° viewer, and Midtrans plus Stripe payments',
      'Full PRD, technical spec and design docs used as context for AI coding agents',
    ],
    links: [{ label: 'Source code', href: 'https://github.com/saifudinreza/Loka-living' }],
    prop: 'sofa',
  },
  {
    id: 'rentwheels',
    name: 'RentWheels',
    tagline: 'Vehicle rental booking',
    year: '2025',
    color: '#3E7BD6',
    stack: ['HTML', 'Tailwind CSS', 'JavaScript', 'Anime.js'],
    highlights: [
      'Multi-step booking flow: pick a motorbike or car, set dates and locations, then add ID details with a document upload',
      'Bank transfer and e-wallet payment options, with an automatic booking summary at the end',
    ],
    links: [
      { label: 'Visit live app', href: 'https://projek-booking-sewa.vercel.app' },
      { label: 'Source code', href: 'https://github.com/saifudinreza/projek-booking-sewa' },
    ],
    prop: 'key',
  },
  {
    id: 'agentmon',
    name: 'AgentMon',
    tagline: 'Review-first phone monitor for coding agents',
    year: '2026',
    badge: 'In development',
    color: '#7C6FE0',
    stack: ['TypeScript', 'Node.js 22', 'pnpm monorepo', 'PWA', 'Vitest', 'GitHub Actions'],
    highlights: [
      'Monitors Claude Code and Codex from a phone: safe actions run on your rules, risky ones surface with a risk level, a plain-language reason and a diff you swipe per hunk',
      'Installs through agent hooks, so you still type claude or codex: no replacement command and no account',
      'Local daemon on 127.0.0.1 with token auth and host checks; hooks are built never to stall the agent',
      'So far: shared event contract, the daemon and the Claude Code adapter, with CI. Rollback and the phone PWA are next',
    ],
    // private repository for now, so there is no public link
    links: [],
    prop: 'phone',
  },
];

export const skillGroups: { title: string; items: string[] }[] = [
  { title: 'Frontend', items: ['React.js', 'Next.js', 'TypeScript', 'JavaScript (ES6+)', 'Zustand', 'TanStack Query', 'Tailwind CSS', 'Bootstrap', 'HTML5', 'CSS3'] },
  { title: 'Backend', items: ['Laravel', 'PHP', 'Bun + ElysiaJS', 'RESTful API Design', 'Sanctum Auth', 'MVC Pattern'] },
  { title: 'Database', items: ['MySQL', 'PostgreSQL', 'Eloquent ORM', 'Drizzle ORM', 'ERD Design', 'Query Optimization'] },
  { title: 'AI & Integrations', items: ['Groq API', 'OpenRouter', 'Midtrans (multi-tenant)', 'Google OAuth', 'Fonnte WhatsApp API', 'Cloudflare R2'] },
  { title: 'AI Coding Agents', items: ['Claude Code', 'Claude Code hooks', 'OpenCode', 'Google Antigravity', 'Agent skills & MCP', 'Spec-driven development'] },
  { title: 'DevOps & Testing', items: ['Git', 'GitHub', 'Docker', 'Nginx', 'PHP-FPM', 'Vercel', 'Render', 'PHPUnit + Pest', 'bun test', 'Postman'] },
];

/** Short labels printed on the knockable crates in the warehouse */
export const crateSkills = [
  'React', 'Next.js', 'Laravel', 'PHP', 'MySQL', 'Postgres', 'Tailwind', 'Zustand',
  'Docker', 'Nginx', 'Git', 'Vercel', 'Render', 'Midtrans', 'LLaMA', 'Claude Code',
];

export const education = [
  { title: 'Bachelor of Information Systems', place: 'Universitas Terbuka (Open University)', detail: '8th semester · Expected graduation 2026' },
  { title: 'Senior High School', place: 'SMA Muhammadiyah Imam Syuhodo (Islamic Boarding School)', detail: '' },
];

export const certifications = [
  { title: 'Full Stack Web Development Bootcamp', issuer: 'Dibimbing.id', detail: '2025 · Final score 97.26 (A+)' },
  { title: 'AWS Cloud & Generative AI Fundamentals', issuer: 'Dicoding Indonesia', detail: 'ID RVZKG98ROXD5 · valid until 2028' },
  { title: 'Python Programming Fundamentals', issuer: 'Dicoding Indonesia', detail: 'ID 07Z63N3DJZQR · valid until 2028' },
];

export const experience = [
  { title: 'Warehouse Operator', place: 'PT Sango Ceramics Indonesia', period: '2023 to present', detail: 'Daily stock checks and inventory records in a warehouse management system, while building software after hours.' },
  { title: 'Store Crew / Store Officer', place: 'PT Sumber Alfaria Trijaya Tbk (Alfamart)', period: 'Prior', detail: 'Store operations including inventory, cash handling, customer service, and financial reporting.' },
];
