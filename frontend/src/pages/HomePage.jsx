import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Home, ClipboardList, BarChart2, Zap } from 'lucide-react';

const DEFAULT_STATS = [
  { value: '500+', label: 'Propiedades activas' },
  { value: '+25',  label: 'Años de experiencia' },
  { value: '1,200+', label: 'Clientes satisfechos' },
  { value: '98%',  label: 'Tasa de cierre' },
];

const DEFAULT_FEATURES = [
  { icon: Home,          title: 'Venta y Renta',          desc: 'Catálogo actualizado de propiedades residenciales y comerciales en las mejores zonas.' },
  { icon: ClipboardList, title: 'Asesoría Personalizada', desc: 'Nuestros asesores te guían en cada paso del proceso de compra, venta o renta.' },
  { icon: BarChart2,     title: 'Valuación de Inmuebles', desc: 'Estimamos el valor real de tu propiedad con estudios de mercado actualizados.' },
  { icon: Zap,           title: 'Gestión Rápida',         desc: 'Procesos ágiles, contratos claros y seguimiento puntual para cerrar en el menor tiempo.' },
];

const FEATURE_ICONS = [Home, ClipboardList, BarChart2, Zap];

function tryJson(str, fallback) {
  try { const p = JSON.parse(str); return Array.isArray(p) ? p : fallback; }
  catch { return fallback; }
}

export default function HomePage() {
  const [heroBadge,        setHeroBadge]        = useState('Bienes Raíces — México');
  const [heroTitle,        setHeroTitle]        = useState('Tu próxima propiedad\ncomienza aquí.');
  const [heroSubtitle,     setHeroSubtitle]     = useState('Conectamos personas con espacios que transforman su vida. Compra, vende o renta con la asesoría de los mejores especialistas.');
  const [heroImage,        setHeroImage]        = useState('https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1600');
  const [heroCtaPrimary,   setHeroCtaPrimary]   = useState('Ver propiedades');
  const [heroCtaSecondary, setHeroCtaSecondary] = useState('Hablar con un asesor');
  const [heroWhatsapp,     setHeroWhatsapp]     = useState('https://wa.me/524427070872?text=%C2%A1Hola!%20Quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios%20inmobiliarios.');
  const [stats,            setStats]            = useState(DEFAULT_STATS);
  const [features,         setFeatures]         = useState(DEFAULT_FEATURES);
  const [whyEyebrow,       setWhyEyebrow]       = useState('¿Por qué elegirnos?');
  const [whyTitle,         setWhyTitle]         = useState('Servicio inmobiliario completo');
  const [whyDesc,          setWhyDesc]          = useState('Desde la búsqueda hasta la firma, te acompañamos con profesionalismo y transparencia.');
  const [featuredTitle,    setFeaturedTitle]    = useState('Encuentra el espacio ideal para ti');
  const [featuredDesc,     setFeaturedDesc]     = useState('Explora nuestro catálogo con las mejores opciones en ubicaciones estratégicas, precios competitivos y todo el respaldo de ARE.');
  const [featuredImage,    setFeaturedImage]    = useState('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900');
  const [ctaTitle,         setCtaTitle]         = useState('¿Listo para dar el siguiente paso?');
  const [ctaDesc,          setCtaDesc]          = useState('Contáctanos hoy y un asesor especializado te atenderá sin compromiso.');
  const [ctaButton,        setCtaButton]        = useState('Contactar ahora');

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '/backare/api';
    axios.get(`${apiBase}/site-content`)
      .then((res) => {
        const d = res.data?.data || {};
        if (d.home_hero_badge)         setHeroBadge(d.home_hero_badge);
        if (d.home_hero_title)         setHeroTitle(d.home_hero_title);
        if (d.home_hero_subtitle)      setHeroSubtitle(d.home_hero_subtitle);
        if (d.home_hero_image)         setHeroImage(d.home_hero_image);
        if (d.home_hero_cta_primary)   setHeroCtaPrimary(d.home_hero_cta_primary);
        if (d.home_hero_cta_secondary) setHeroCtaSecondary(d.home_hero_cta_secondary);
        if (d.home_hero_whatsapp)      setHeroWhatsapp(d.home_hero_whatsapp);
        if (d.home_stats)              setStats(tryJson(d.home_stats, DEFAULT_STATS));
        if (d.home_features) {
          const parsed = tryJson(d.home_features, null);
          if (parsed) {
            setFeatures(parsed.map((f, i) => ({ ...f, icon: FEATURE_ICONS[i % FEATURE_ICONS.length] })));
          }
        }
        if (d.home_why_eyebrow)    setWhyEyebrow(d.home_why_eyebrow);
        if (d.home_why_title)      setWhyTitle(d.home_why_title);
        if (d.home_why_desc)       setWhyDesc(d.home_why_desc);
        if (d.home_featured_title) setFeaturedTitle(d.home_featured_title);
        if (d.home_featured_desc)  setFeaturedDesc(d.home_featured_desc);
        if (d.home_featured_image) setFeaturedImage(d.home_featured_image);
        if (d.home_cta_title)      setCtaTitle(d.home_cta_title);
        if (d.home_cta_desc)       setCtaDesc(d.home_cta_desc);
        if (d.home_cta_button)     setCtaButton(d.home_cta_button);
      })
      .catch(() => {}); // silently use defaults
  }, []);

  // Split title on newline for the colored-last-word effect
  const titleLines = heroTitle.split('\n');

  return (
    <>
      {/* Hero */}
      <section className="surface-dark relative overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url('${heroImage}')` }}
        />
        <div className="relative section-shell py-28 md:py-36">
          <div className="max-w-2xl" data-aos="fade-up">
            <span className="font-subheading mb-4 inline-block rounded-full border border-brand-500 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-brand-100">
              {heroBadge}
            </span>
            <h1 className="font-heading text-4xl font-black leading-tight text-white md:text-6xl">
              {titleLines.map((line, i) =>
                i < titleLines.length - 1
                  ? <span key={i}>{line}<br /></span>
                  : <span key={i} className="text-brand-500">{line}</span>
              )}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-300">
              {heroSubtitle}
            </p>
            <div className="mt-10 flex flex-nowrap gap-4">
              <Link
                to="/properties"
                className="rounded-xl bg-brand-500 px-6 py-4 font-bold text-white shadow-lg transition hover:bg-brand-700 whitespace-nowrap"
              >
                {heroCtaPrimary}
              </Link>
              <a
                href={heroWhatsapp}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/30 px-6 py-4 font-bold text-white transition hover:border-brand-500 hover:text-brand-500 whitespace-nowrap"
              >
                {heroCtaSecondary}
              </a>
            </div>
          </div>
        </div>

        {/* Diagonal cut */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-isabelline" style={{ clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }} />
      </section>

      {/* Stats bar */}
      <section className="bg-white/90 py-10 shadow-sm backdrop-blur-sm">
        <div className="section-shell grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center" data-aos="fade-up">
              <p className="font-heading text-3xl font-black text-brand-500 md:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features + Propiedades destacadas */}
      <section className="py-20">
        <div className="section-shell">
          <div className="mb-12 text-center" data-aos="fade-up">
            <span className="font-subheading text-xs uppercase tracking-[0.22em] text-brand-500">{whyEyebrow}</span>
            <h2 className="mt-2 font-heading text-3xl font-black text-slate-950 md:text-4xl">
              {whyTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-500">
              {whyDesc}
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  data-aos="fade-up"
                  className="surface-panel group rounded-2xl p-8 cursor-default"
                >
                  {Icon && <Icon size={36} className="text-brand-500" />}
                  <h3 className="mt-4 font-heading text-lg font-bold text-slate-950">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Propiedades destacadas */}
          <div className="mt-10 grid items-center gap-6 lg:grid-cols-2" data-aos="fade-up">
            <div>
              <span className="font-subheading text-xs uppercase tracking-[0.22em] text-brand-500">Propiedades destacadas</span>
              <h2 className="mt-1 font-heading text-2xl font-black text-slate-950 md:text-4xl">
                {featuredTitle}
              </h2>
              <p className="mt-3 text-sm text-gray-600 md:text-base">
                {featuredDesc}
              </p>
              <Link
                to="/properties"
                className="mt-5 inline-block rounded-xl bg-brand-500 px-7 py-3 font-bold text-white transition hover:bg-brand-700"
              >
                Explorar catálogo
              </Link>
            </div>
            <div data-aos="fade-left" className="overflow-hidden rounded-3xl shadow-2xl">
              <img
                src={featuredImage}
                alt="Propiedad destacada"
                className="h-56 w-full object-cover transition duration-500 hover:scale-105 md:h-72"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section
        className="py-20 text-isabelline"
        style={{
          background: 'linear-gradient(135deg, #434242 0%, #606060 100%)',
          borderTop: '1px solid rgba(188, 86, 29, 0.45)',
          borderBottom: '1px solid rgba(188, 86, 29, 0.45)'
        }}
      >
        <div className="section-shell text-center" data-aos="fade-up">
          <h2 className="font-heading text-3xl font-black text-isabelline md:text-4xl">
            {ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-gray-100">
            {ctaDesc}
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-block rounded-xl bg-brand-500 px-10 py-4 font-bold text-isabelline transition hover:bg-brand-700"
          >
            {ctaButton}
          </Link>
        </div>
      </section>
    </>
  );
}

