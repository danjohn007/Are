import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ArrowRight, Download, MapPin, Phone, Mail, Calendar,
  TrendingUp, Home, Users, CheckCircle2,
  Star, Award, Handshake, Key, BarChart2, Heart, Zap, Globe, Lock, Shield,
  CheckCircle, Users2,
} from 'lucide-react';

const DIFF_ICONS = {
  CheckCircle, CheckCircle2, Home, Users, Users2, TrendingUp,
  Star, Award, Handshake, MapPin, Key, BarChart2, Heart, Zap, Globe, Lock, Shield, Phone,
};

function tryJson(str, fallback) {
  try { const p = JSON.parse(str); return Array.isArray(p) ? p : fallback; }
  catch { return fallback; }
}

/* ─── Datos de la empresa (defaults) ────────────────────────────── */
const DEFAULT_FACTS = [
  { number: '1999',   label: 'Año de fundación' },
  { number: '+25',    label: 'Años de trayectoria' },
  { number: '500+',   label: 'Propiedades activas' },
  { number: '1,200+', label: 'Clientes cerrados' },
  { number: '98%',    label: 'Tasa de cierre' },
  { number: '3',      label: 'Oficinas en Querétaro' },
];

/* ─── Equipo (defaults) ────────────────────────────────────────── */
const DEFAULT_TEAM = [
  {
    name: 'Roberto Álvarez',
    role: 'Director General',
    bio: 'Fundador de ARE con más de 25 años en el sector inmobiliario. Especialista en desarrollos residenciales y comerciales.',
    photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80',
    linkedin: '#',
    instagram: null,
  },
  {
    name: 'Fernanda Castro',
    role: 'Directora Comercial',
    bio: 'Experta en captación y cierre de operaciones. Más de 15 años asesorando a clientes en compra y renta de alto valor.',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80',
    linkedin: '#',
    instagram: '#',
  },
  {
    name: 'Miguel Herrera',
    role: 'Asesor Senior',
    bio: 'Especialista en propiedades residenciales de lujo y zonas de alta plusvalía en el Bajío. Certificado AMPI.',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
    linkedin: '#',
    instagram: '#',
  },
  {
    name: 'Lucía Mendoza',
    role: 'Asesora Inmobiliaria',
    bio: 'Especializada en desarrollos nuevos y primera vivienda. Conoce a fondo el mercado de Juriquilla y El Marqués.',
    photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
    linkedin: '#',
    instagram: '#',
  },
];

/* ─── Hitos históricos (defaults) ─────────────────────────────── */
const DEFAULT_TIMELINE = [
  { year: '1999', desc: 'Fundación en Querétaro con enfoque en bienes raíces residenciales.' },
  { year: '2005', desc: 'Expansión al segmento comercial y apertura de segunda oficina.' },
  { year: '2012', desc: 'Inicio de comercialización de desarrollos de alto impacto.' },
  { year: '2019', desc: 'Lanzamiento de nuestra plataforma digital propia.' },
  { year: '2024', desc: 'Reconocimiento como Top Agencia AMPI Querétaro.' },
];

/* ─── Diferenciadores ────────────────────────────────────────────── */
const differentiators = [
  { icon: CheckCircle2, title: 'Asesores certificados AMPI',   desc: 'Todo nuestro equipo cuenta con certificación de la Asociación Mexicana de Profesionales Inmobiliarios.' },
  { icon: TrendingUp,   title: 'Estudio de mercado incluido',  desc: 'Valuación sin costo con cada operación para garantizar decisiones informadas.' },
  { icon: Home,         title: 'Cartera exclusiva',            desc: 'Acceso a propiedades fuera de mercado y preventa antes de publicación pública.' },
  { icon: Users,        title: 'Acompañamiento total',         desc: 'Desde la búsqueda hasta escrituración: jurídico, financiero y logístico.' },
];

/* ─── Eyebrow reutilizable ───────────────────────────────────────── */
function Eyebrow({ text }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="h-px w-7 bg-brand-500" />
      <span className="text-xs font-semibold uppercase tracking-widest text-brand-500">{text}</span>
    </div>
  );
}

export default function AboutPage() {
  const [description, setDescription] = useState('Más de dos décadas conectando familias y empresas con las mejores propiedades de Querétaro y el Bajío. Transparentes, comprometidos y siempre a tu lado.');
  const [heroImage, setHeroImage] = useState('https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80');
  const [companyFacts, setCompanyFacts] = useState(DEFAULT_FACTS);
  const [team, setTeam] = useState(DEFAULT_TEAM);
  const [timeline, setTimeline] = useState(DEFAULT_TIMELINE);
  const [diffs, setDiffs] = useState(differentiators);
  const [brochureUrl, setBrochureUrl] = useState('/brochure-are.pdf');
  const [mission, setMission] = useState('Ser el puente entre las personas y el hogar que cambiará su vida.');
  const [missionDesc, setMissionDesc] = useState('Facilitar el acceso a bienes raíces de calidad mediante asesoría profesional, personalizada e íntegra, creando experiencias satisfactorias para compradores, vendedores y arrendatarios en cada etapa del proceso.');
  const [vision, setVision] = useState('Ser la inmobiliaria de referencia en Querétaro y el Bajío.');
  const [visionDesc, setVisionDesc] = useState('Aspiramos a liderar el mercado regional con innovación y servicio humano, reconocidos por excelencia, tecnología y ética profesional.');

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '/backare/api';
    axios.get(`${apiBase}/site-content`)
      .then((res) => {
        const d = res.data?.data || {};
        if (d.about_description) setDescription(d.about_description);
        if (d.about_hero_image) setHeroImage(d.about_hero_image);
        if (d.about_facts) setCompanyFacts(tryJson(d.about_facts, DEFAULT_FACTS));
        if (d.about_team) {
          const t = tryJson(d.about_team, DEFAULT_TEAM);
          // Preserve linkedin/instagram placeholders if missing
          setTeam(t.map(m => ({ linkedin: '#', instagram: null, ...m })));
        }
        if (d.about_timeline) setTimeline(tryJson(d.about_timeline, DEFAULT_TIMELINE));
        if (d.about_differentiators) setDiffs(tryJson(d.about_differentiators, differentiators));
        if (d.about_brochure) setBrochureUrl(d.about_brochure);
        if (d.about_mission) {
          try { const p = JSON.parse(d.about_mission); setMission(p.title || d.about_mission); setMissionDesc(p.desc || ''); }
          catch { setMission(d.about_mission); }
        }
        if (d.about_vision) {
          try { const p = JSON.parse(d.about_vision); setVision(p.title || d.about_vision); setVisionDesc(p.desc || ''); }
          catch { setVision(d.about_vision); }
        }
      })
      .catch(() => {}); // silently use defaults
  }, []);

  return (
    <div className="overflow-x-hidden bg-white">

      {/* ══════════════════════════════════════
          HERO — split: texto / foto
      ══════════════════════════════════════ */}
      <section className="section-shell py-8 md:py-10">
        <div className="grid md:grid-cols-2 gap-10 md:items-center">

          {/* Texto */}
          <div data-aos="fade-right" data-aos-duration="700">
            <Eyebrow text="Quiénes somos" />

            <h1 className="font-heading text-5xl font-black leading-tight text-slate-900 md:text-6xl">
              are <span className="text-brand-500">REAL ESTATE</span>
            </h1>

            <p className="mt-4 text-base text-gray-600 leading-relaxed max-w-md">
              {description}
            </p>


            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="group inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-600"
              >
                Hablar con un asesor
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              {brochureUrl && (
                <a
                  href={brochureUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-500"
                >
                  <Download className="h-4 w-4" />
                  Descargar brochure
                </a>
              )}
            </div>
          </div>

          {/* Foto */}
          <div className="relative" data-aos="fade-left" data-aos-duration="700" data-aos-delay="100">
            <img
              src={heroImage}
              alt="Oficinas are REAL ESTATE"
              className="w-full h-[420px] object-cover rounded-2xl shadow-2xl"
            />
            <div
              className="absolute -bottom-5 -left-5 rounded-xl bg-brand-500 px-5 py-4 text-white shadow-xl"
              data-aos="zoom-in" data-aos-delay="350"
            >
              <p className="font-heading text-4xl font-black leading-none">+25</p>
              <p className="mt-0.5 text-xs font-medium text-brand-100">años de experiencia</p>
            </div>
            <div className="absolute -top-3 -right-3 h-16 w-16 rounded-full bg-brand-50 -z-10" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CIFRAS — franja oscura
      ══════════════════════════════════════ */}
      <section className="bg-slate-900 py-10">
        <div className="section-shell">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-white/10 rounded-xl overflow-hidden">
            {companyFacts.map(({ number, label }, i) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center"
                data-aos="fade-up"
                data-aos-delay={i * 50}
              >
                <span className="font-heading text-3xl font-black text-brand-400">{number}</span>
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400 mt-0.5 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          MISIÓN + VISIÓN
      ══════════════════════════════════════ */}
      <section className="section-shell py-8 md:py-10">
        <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:items-start">

          {/* Misión */}
          <div data-aos="fade-right" data-aos-duration="700">
            <Eyebrow text="Misión" />
            <h2 className="font-heading text-3xl font-black text-slate-800 mb-4 leading-tight">
              {mission}
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              {missionDesc}
            </p>
          </div>

          {/* Visión */}
          <div
            className="relative rounded-2xl bg-brand-500 p-8 text-white overflow-hidden"
            data-aos="fade-left" data-aos-duration="700" data-aos-delay="100"
          >
            <span className="absolute -top-4 -left-1 font-heading text-[8rem] font-black leading-none text-white/10 select-none">"</span>
            <div className="relative">
              <Eyebrow text="Visión" />
              <h2 className="font-heading text-2xl font-black leading-snug mb-3 text-white">
                {vision}
              </h2>
              <p className="text-sm text-brand-100 leading-relaxed">
                {visionDesc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          ¿POR QUÉ ELEGIR ARE?
      ══════════════════════════════════════ */}
      <section className="bg-slate-50 py-8 md:py-10">
        <div className="section-shell">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">

            {/* Foto */}
            <div className="relative order-2 md:order-1" data-aos="fade-right" data-aos-duration="700">
              <img
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900&q=80"
                alt="Equipo ARE"
                className="h-[360px] w-full rounded-2xl object-cover shadow-xl"
              />
              <div className="absolute top-5 right-5 rounded-xl bg-white px-4 py-3 shadow-lg text-center border border-gray-100">
                <p className="font-heading text-2xl font-black text-brand-500">AMPI</p>
                <p className="text-xs text-gray-500">Certificados</p>
              </div>
            </div>

            {/* Lista */}
            <div className="order-1 md:order-2" data-aos="fade-left" data-aos-duration="700">
              <Eyebrow text="Diferenciadores" />
              <h2 className="font-heading text-3xl font-black text-slate-800 mb-7 leading-tight">
                ¿Por qué elegir<br />are REAL ESTATE?
              </h2>

              <div className="space-y-5">
                {diffs.map(({ icon, title, desc }, i) => {
                  const Icon = DIFF_ICONS[icon] || CheckCircle2;
                  return (
                    <div key={i} className="flex gap-4" data-aos="fade-up" data-aos-delay={i * 70}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                        <Icon className="h-5 w-5 text-brand-500" />
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-slate-800 mb-0.5 text-sm">{title}</h4>
                        <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HISTORIA — timeline horizontal
      ══════════════════════════════════════ */}
      <section className="section-shell py-8 md:py-10">
        <div className="mb-10" data-aos="fade-up">
          <Eyebrow text="Trayectoria" />
          <h2 className="font-heading text-3xl font-black text-slate-800">Nuestra historia</h2>
        </div>

        <div className="relative">
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-300 to-brand-100 hidden md:block" />
          <div className="grid gap-6 md:grid-cols-5">
            {timeline.map(({ year, desc }, i) => (
              <div key={year} className="relative" data-aos="fade-up" data-aos-delay={i * 70} data-aos-duration="600">
                <div className="hidden md:flex mb-5 justify-start">
                  <div className="h-4 w-4 rounded-full border-2 border-brand-500 bg-white shadow-sm shadow-brand-500/30" />
                </div>
                <span className="font-heading text-2xl font-black text-brand-500 block mb-1">{year}</span>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          EQUIPO
      ══════════════════════════════════════ */}
      <section className="bg-slate-50 py-8 md:py-10">
        <div className="section-shell">
          <div className="mb-10" data-aos="fade-up">
            <Eyebrow text="Equipo" />
            <h2 className="font-heading text-3xl font-black text-slate-800">Las personas detrás de ARE</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map(({ name, role, bio, photo, linkedin, instagram }, i) => (
              <div
                key={name}
                className="group overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
                data-aos="fade-up" data-aos-delay={i * 70} data-aos-duration="650"
              >
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={photo}
                    alt={name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-end justify-end gap-2 p-3 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/40 to-transparent">
                    {instagram && (
                      <a href={instagram} target="_blank" rel="noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 hover:bg-brand-500 hover:text-white transition"
                        aria-label="Instagram">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="font-heading font-black text-slate-800 text-base leading-tight">{name}</h4>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-500 mt-0.5 mb-2">{role}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          BROCHURE
      ══════════════════════════════════════ */}
      <section className="section-shell py-8 md:py-10">
        <div
          className="relative overflow-hidden rounded-2xl bg-slate-900 px-8 py-12 md:px-14 md:py-14"
          data-aos="zoom-in" data-aos-duration="700"
        >
          <div className="absolute inset-0 bg-glow opacity-50 pointer-events-none" />
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <Eyebrow text="Material corporativo" />
              <h2 className="font-heading text-3xl font-black text-white mb-3 leading-tight">
                Descarga nuestro brochure corporativo
              </h2>
              <p className="text-gray-400 leading-relaxed max-w-lg text-sm">
                Conoce nuestros servicios, cartera de propiedades, datos corporativos y casos de éxito.
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400">
                {['Portafolio de servicios', 'Datos corporativos', 'Casos de éxito', 'Equipo y certificaciones'].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col items-start gap-2 md:items-end">
              {brochureUrl && (
                <a
                  href={brochureUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-brand-500 px-7 py-4 font-semibold text-white shadow-lg shadow-brand-900/40 transition hover:bg-brand-400 whitespace-nowrap"
                >
                  <Download className="h-5 w-5" />
                  Descargar PDF
                </a>
              )}
              <p className="text-xs text-gray-600">PDF · Actualizado 2025</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CONTACTO RÁPIDO
      ══════════════════════════════════════ */}
      <section className="border-t border-gray-100 bg-white py-10">
        <div className="section-shell">
          <div className="grid gap-6 md:grid-cols-3 text-center" data-aos="fade-up">
            {[
              { icon: MapPin, label: 'Oficinas',  value: 'Querétaro, Qro., México' },
              { icon: Phone,  label: 'Teléfono',  value: '+52 442 707 0872' },
              { icon: Mail,   label: 'Correo',    value: 'info@are.mx' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                  <Icon className="h-4 w-4 text-brand-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
                  <p className="font-medium text-slate-800 text-sm">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
