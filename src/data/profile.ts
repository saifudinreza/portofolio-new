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
  prop: 'register' | 'house' | 'coins' | 'sofa' | 'bag' | 'key';
};

export const profile = {
  name: 'Saifudin Reza',
  handle: 'zare',
  role: 'Junior Software Engineer · Full Stack Web Developer',
  location: 'Kendal, Central Java, Indonesia',
  email: 'donojomi@gmail.com',
  summary:
    'Full stack developer specializing in Next.js and Laravel. I ship products end-to-end, from schema design and REST APIs to AI integration, payment gateways, and Docker/Nginx deployment. My flagship, KasirAI, is a live multi-tenant SaaS POS platform used by independent businesses. I build with AI coding agents like Claude Code while personally owning the critical logic, and I do all of this while working full-time and finishing my Information Systems degree.',
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
    year: '2025',
    badge: 'Flagship · Live',
    color: '#2BA89A',
    stack: ['Next.js 14', 'Laravel 11', 'MySQL', 'Groq LLaMA 3.3 70B', 'Midtrans', 'Cloudflare R2', 'Docker', 'Railway', 'Vercel'],
    highlights: [
      'Live multi-tenant SaaS POS serving independent businesses on isolated tenant data',
      '36 REST API endpoints across 8 controllers with Sanctum token auth',
      'AI sales assistant powered by Groq LLaMA 3.3 70B for product insights and reporting',
      'Per-tenant Midtrans payments, Cloudflare R2 storage, Fonnte WhatsApp receipts, GA4',
      'Docker + Nginx + PHP-FPM on Railway, frontend on Vercel',
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
    year: '2025',
    color: '#F26B4F',
    stack: ['Next.js', 'Laravel', 'MySQL', 'Midtrans', 'Pusher'],
    highlights: [
      '9-table relational schema and 35+ REST API endpoints',
      'Tenants, rooms, billing, and payments for boarding house owners',
      'Midtrans rent payments and Pusher real-time notifications',
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
    year: '2025',
    color: '#F5B83D',
    stack: ['React (Vite)', 'Laravel', 'MySQL', 'Midtrans'],
    highlights: [
      'Server-validated balances with atomic peer-to-peer transfers',
      'Full transaction ledger so every balance is auditable',
      'Midtrans wallet top-up and protected routes',
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
    year: '2025',
    color: '#C68B59',
    stack: ['Next.js', 'Laravel', 'PostgreSQL'],
    highlights: [
      'Warm, eco-conscious storefront with FLIP-based product animations',
      'Full PRD, design spec, and workflow docs used as context for AI coding agents',
    ],
    links: [],
    prop: 'sofa',
  },
  {
    id: 'zflux',
    name: 'ZFlux',
    tagline: 'Role-based marketplace',
    year: '2025',
    color: '#7C6FE0',
    stack: ['React (Vite)', 'Laravel', 'MySQL', 'Tailwind CSS', 'Midtrans'],
    highlights: [
      'Buyer and seller roles with protected routes on both ends',
      'Cart and checkout with an interactive map for the shipping address',
      'Midtrans Snap payments with webhook handling',
    ],
    links: [
      { label: 'Visit live app', href: 'https://marketplace-app-ten-rosy.vercel.app' },
      { label: 'Source code', href: 'https://github.com/saifudinreza/marketplace-app' },
    ],
    prop: 'bag',
  },
  {
    id: 'rentwheels',
    name: 'RentWheels',
    tagline: 'Vehicle rental booking',
    year: '2024',
    color: '#3E7BD6',
    stack: ['React', 'Laravel', 'MySQL'],
    highlights: [
      '4-step reservation flow with ID and selfie document upload',
      'Multiple simulated payment methods and printable receipts',
    ],
    links: [{ label: 'Visit live app', href: 'https://projek-booking-sewa.vercel.app' }],
    prop: 'key',
  },
];

export const skillGroups: { title: string; items: string[] }[] = [
  { title: 'Frontend', items: ['React.js', 'Next.js 14', 'JavaScript (ES6+)', 'Zustand', 'Tailwind CSS', 'Bootstrap', 'HTML5', 'CSS3'] },
  { title: 'Backend', items: ['Laravel 11', 'PHP', 'RESTful API Design', 'Sanctum Auth', 'MVC Pattern'] },
  { title: 'Database', items: ['MySQL', 'PostgreSQL', 'Eloquent ORM', 'ERD Design', 'Query Optimization'] },
  { title: 'AI & Integrations', items: ['Groq LLaMA 3.3 70B', 'Midtrans (multi-tenant)', 'Pusher', 'Fonnte WhatsApp API', 'Cloudflare R2', 'Google Analytics 4'] },
  { title: 'AI Coding Agents', items: ['Claude Code', 'OpenCode', 'Google Antigravity', 'Agent skills & MCP', 'Spec-driven development'] },
  { title: 'DevOps & Tools', items: ['Git', 'GitHub', 'Docker', 'Nginx', 'PHP-FPM', 'Vercel', 'Railway', 'Postman'] },
];

/** Short labels printed on the knockable crates in the warehouse */
export const crateSkills = [
  'React', 'Next.js', 'Laravel', 'PHP', 'MySQL', 'Postgres', 'Tailwind', 'Zustand',
  'Docker', 'Nginx', 'Git', 'Vercel', 'Railway', 'Midtrans', 'LLaMA', 'Claude Code',
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
