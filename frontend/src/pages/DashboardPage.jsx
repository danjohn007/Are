import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import {
  Inbox, Sparkles, Phone, CheckCircle, Home, Building2,
  Trash2, Save, Pencil, X, RefreshCw, Wrench, Plus,
  LayoutDashboard, Newspaper, LogOut, TrendingUp, Clock, User, Tag,
  Users2, FileText, Shield, Target, Upload, Download,
  Star, Award, Handshake, MapPin, Key, BarChart2, Heart, Zap, Globe, Lock,
} from 'lucide-react';

const DIFF_ICONS = {
  CheckCircle, Home, Users2, TrendingUp, Star, Award,
  Handshake, MapPin, Key, BarChart2, Heart, Zap, Globe, Lock, Shield, Phone,
};
const DIFF_ICON_KEYS = Object.keys(DIFF_ICONS);

const initialArticle = { title: '', slug: '', excerpt: '', content: '', image_url: '', external_url: '', published: true };
const initialService = { name: '', slug: '', description: '', image_url: '', active: true };

const INPUT = [
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-arsenic',
  'placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2',
  'focus:ring-brand-100 transition-all font-body',
].join(' ');

function toSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const DEFAULT_FACTS = [
  { number: '1999',   label: 'Ano de fundacion' },
  { number: '+25',    label: 'Anos de trayectoria' },
  { number: '500+',   label: 'Propiedades activas' },
  { number: '1,200+', label: 'Clientes cerrados' },
  { number: '98%',    label: 'Tasa de cierre' },
  { number: '3',      label: 'Oficinas en Queretaro' },
];

const DEFAULT_TEAM = [
  { name: 'Roberto Alvarez', role: 'Director General', bio: 'Fundador de ARE con mas de 25 anos en el sector inmobiliario. Especialista en desarrollos residenciales y comerciales.', photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80' },
  { name: 'Fernanda Castro', role: 'Directora Comercial', bio: 'Experta en captacion y cierre de operaciones. Mas de 15 anos asesorando a clientes en compra y renta de alto valor.', photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80' },
  { name: 'Miguel Herrera', role: 'Asesor Senior', bio: 'Especialista en propiedades residenciales de lujo y zonas de alta plusvalia en el Bajio. Certificado AMPI.', photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80' },
  { name: 'Lucia Mendoza', role: 'Asesora Inmobiliaria', bio: 'Especializada en desarrollos nuevos y primera vivienda. Conoce a fondo el mercado de Juriquilla y El Marques.', photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80' },
];

const DEFAULT_TIMELINE = [
  { year: '1999', desc: 'Fundacion en Queretaro con enfoque en bienes raices residenciales.' },
  { year: '2005', desc: 'Expansion al segmento comercial y apertura de segunda oficina.' },
  { year: '2012', desc: 'Inicio de comercializacion de desarrollos de alto impacto.' },
  { year: '2019', desc: 'Lanzamiento de nuestra plataforma digital propia.' },
  { year: '2024', desc: 'Reconocimiento como Top Agencia AMPI Queretaro.' },
];

const DEFAULT_DIFFERENTIATORS = [
  { icon: 'CheckCircle', title: 'Asesores certificados AMPI', desc: 'Todo nuestro equipo cuenta con certificacion de la Asociacion Mexicana de Profesionales Inmobiliarios.' },
  { icon: 'TrendingUp',  title: 'Estudio de mercado incluido', desc: 'Valuacion sin costo con cada operacion para garantizar decisiones informadas.' },
  { icon: 'Home',        title: 'Cartera exclusiva', desc: 'Acceso a propiedades fuera de mercado y preventa antes de publicacion publica.' },
  { icon: 'Users2',      title: 'Acompanamiento total', desc: 'Desde la busqueda hasta escrituracion: juridico, financiero y logistico.' },
];

function tryJson(str, fallback) {
  try { const p = JSON.parse(str); return Array.isArray(p) ? p : fallback; }
  catch { return fallback; }
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('metrics');
  const [metrics, setMetrics] = useState(null);
  const [articles, setArticles] = useState([]);
  const [articleForm, setArticleForm] = useState(initialArticle);
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceForm, setServiceForm] = useState(initialService);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const formRef = useRef(null);
  const serviceFormRef = useRef(null);

  // Site content
  const [contentLoaded, setContentLoaded] = useState(false);
  const [aboutHeroDesc, setAboutHeroDesc] = useState('Mas de dos decadas conectando familias y empresas con las mejores propiedades de Queretaro y el Bajio. Transparentes, comprometidos y siempre a tu lado.');
  const [aboutHeroImage, setAboutHeroImage] = useState('https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80');
  const [aboutFacts, setAboutFacts] = useState(DEFAULT_FACTS);
  const [aboutTeam, setAboutTeam] = useState(DEFAULT_TEAM);
  const [aboutTimeline, setAboutTimeline] = useState(DEFAULT_TIMELINE);
  const [aboutMission, setAboutMission] = useState({ title: '', desc: '' });
  const [aboutVision, setAboutVision] = useState({ title: '', desc: '' });
  const [aboutDifferentiators, setAboutDifferentiators] = useState(DEFAULT_DIFFERENTIATORS);
  const [aboutBrochure, setAboutBrochure] = useState('');
  const [legalPrivacy, setLegalPrivacy] = useState('http://alterrarealestate.tuinmobiliaria.com.ar/Privacidad');
  const [legalTerms, setLegalTerms] = useState('');
  const [saving, setSaving] = useState('');

  // Leads CRM
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsStatusFilter, setLeadsStatusFilter] = useState('');

  async function syncTokko() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await api.post('/properties/sync/tokko');
      const count = res.data?.data?.synced ?? '?';
      setSyncMsg(`Sincronizacion completada - ${count} propiedades actualizadas.`);
    } catch {
      setSyncMsg('Error al sincronizar. Intenta nuevamente.');
    } finally {
      setSyncing(false);
    }
  }

  async function loadData() {
    const [m, a] = await Promise.all([
      api.get('/dashboard/metrics'),
      api.get('/articles?limit=50&page=1&all=1'),
    ]);
    setMetrics(m.data.data);
    setArticles(a.data.data);
  }

  async function loadServices() {
    const res = await api.get('/services?limit=50&page=1&all=1');
    setServices(res.data.data || []);
  }

  async function loadSiteContent() {
    if (contentLoaded) return;
    try {
      const res = await api.get('/site-content');
      const d = res.data.data || {};
      if (d.about_description) setAboutHeroDesc(d.about_description);
      if (d.about_hero_image) setAboutHeroImage(d.about_hero_image);
      if (d.about_facts) setAboutFacts(tryJson(d.about_facts, DEFAULT_FACTS));
      if (d.about_team) setAboutTeam(tryJson(d.about_team, DEFAULT_TEAM));
      if (d.about_timeline) setAboutTimeline(tryJson(d.about_timeline, DEFAULT_TIMELINE));
      if (d.about_mission) {
        try { const p = JSON.parse(d.about_mission); setAboutMission({ title: p.title || '', desc: p.desc || '' }); }
        catch { setAboutMission({ title: d.about_mission, desc: '' }); }
      }
      if (d.about_vision) {
        try { const p = JSON.parse(d.about_vision); setAboutVision({ title: p.title || '', desc: p.desc || '' }); }
        catch { setAboutVision({ title: d.about_vision, desc: '' }); }
      }
      if (d.about_differentiators) setAboutDifferentiators(tryJson(d.about_differentiators, DEFAULT_DIFFERENTIATORS));
      if (d.about_brochure) setAboutBrochure(d.about_brochure);
      if (d.legal_privacy) setLegalPrivacy(d.legal_privacy);
      if (d.legal_terms) setLegalTerms(d.legal_terms);
      // Home page
      if (d.home_hero_badge)      setHomeHeroBadge(d.home_hero_badge);
      if (d.home_hero_title)      setHomeHeroTitle(d.home_hero_title);
      if (d.home_hero_subtitle)   setHomeHeroSubtitle(d.home_hero_subtitle);
      if (d.home_hero_image)      setHomeHeroImage(d.home_hero_image);
      if (d.home_hero_cta_primary)   setHomeHeroCtaPrimary(d.home_hero_cta_primary);
      if (d.home_hero_cta_secondary) setHomeHeroCtaSecondary(d.home_hero_cta_secondary);
      if (d.home_hero_whatsapp)   setHomeHeroWhatsapp(d.home_hero_whatsapp);
      if (d.home_stats)           setHomeStats(tryJson(d.home_stats, homeStats));
      if (d.home_features)        setHomeFeatures(tryJson(d.home_features, homeFeatures));
      if (d.home_why_eyebrow)     setHomeWhyEyebrow(d.home_why_eyebrow);
      if (d.home_why_title)       setHomeWhyTitle(d.home_why_title);
      if (d.home_why_desc)        setHomeWhyDesc(d.home_why_desc);
      if (d.home_featured_title)  setHomeFeaturedTitle(d.home_featured_title);
      if (d.home_featured_desc)   setHomeFeaturedDesc(d.home_featured_desc);
      if (d.home_featured_image)  setHomeFeaturedImage(d.home_featured_image);
      if (d.home_cta_title)       setHomeCtaTitle(d.home_cta_title);
      if (d.home_cta_desc)        setHomeCtaDesc(d.home_cta_desc);
      if (d.home_cta_button)      setHomeCtaButton(d.home_cta_button);
    } catch {}
    finally { setContentLoaded(true); }
  }

  async function saveKey(key, value, label) {
    setSaving(label);
    try { await api.put(`/site-content/${key}`, { value }); }
    finally { setSaving(''); }
  }

  async function uploadDoc(file, setter) {
    const formData = new FormData();
    formData.append('image', file);
    setSaving('doc');
    try {
      const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setter(res.data.data.url);
    } finally { setSaving(''); }
  }

  async function loadLeads(status = '') {
    setLeadsLoading(true);
    try {
      const params = status ? `?status=${status}&limit=100&page=1` : '?limit=100&page=1';
      const res = await api.get(`/leads${params}`);
      setLeads(res.data.data || []);
    } catch { setLeads([]); }
    finally { setLeadsLoading(false); }
  }

  async function updateLeadStatus(id, newStatus) {
    try {
      await api.patch(`/leads/${id}`, { status: newStatus });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    } catch { alert('No se pudo actualizar el estado.'); }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (tab === 'services') loadServices(); }, [tab]);
  useEffect(() => { if (tab === 'leads') loadLeads(leadsStatusFilter); }, [tab]); // eslint-disable-line
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'about' || tab === 'legal' || tab === 'home') loadSiteContent(); }, [tab]);

  async function submitArticle(event) {
    event.preventDefault();
    if (editingArticleId) {
      await api.put(`/articles/${editingArticleId}`, articleForm);
    } else {
      await api.post('/articles', articleForm);
    }
    setEditingArticleId(null);
    setArticleForm(initialArticle);
    await loadData();
  }

  function startEditArticle(article) {
    setEditingArticleId(article.id);
    setArticleForm({
      title: article.title || '',
      slug: article.slug || '',
      excerpt: article.excerpt || '',
      content: article.content || '',
      image_url: article.image_url || '',
      external_url: article.external_url || '',
      published: article.published !== 0 && article.published !== false,
    });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function cancelEditArticle() {
    setEditingArticleId(null);
    setArticleForm(initialArticle);
  }

  async function deleteArticle(id) {
    if (window.confirm('Eliminar este articulo?')) {
      await api.delete(`/articles/${id}`);
      await loadData();
    }
  }

  async function submitService(event) {
    event.preventDefault();
    if (editingServiceId) {
      await api.put(`/services/${editingServiceId}`, { ...serviceForm });
    } else {
      await api.post('/services', { ...serviceForm });
    }
    setEditingServiceId(null);
    setServiceForm(initialService);
    await loadServices();
  }

  function startEditService(s) {
    setEditingServiceId(s.id);
    setServiceForm({
      name: s.name || '',
      slug: s.slug || '',
      description: s.description || '',
      image_url: s.image_url || '',
      active: s.active !== 0 && s.active !== false,
    });
    setTimeout(() => serviceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function cancelEditService() {
    setEditingServiceId(null);
    setServiceForm(initialService);
  }

  async function deleteService(id) {
    if (window.confirm('Eliminar este servicio?')) {
      await api.delete(`/services/${id}`);
      await loadServices();
    }
  }

  async function toggleServiceActive(s) {
    await api.put(`/services/${s.id}`, {
      name: s.name, slug: s.slug, description: s.description,
      image_url: s.image_url, active: !s.active,
    });
    await loadServices();
  }

  async function toggleArticlePublished(art) {
    await api.put(`/articles/${art.id}`, {
      title: art.title, slug: art.slug, excerpt: art.excerpt,
      content: art.content, image_url: art.image_url,
      external_url: art.external_url, published: !art.published,
    });
    await loadData();
  }

  // ─── Home page state ──────────────────────────────────────────────
  const [homeHeroBadge, setHomeHeroBadge] = useState('Bienes Raíces — México');
  const [homeHeroTitle, setHomeHeroTitle] = useState('Tu próxima propiedad\ncomienza aquí.');
  const [homeHeroSubtitle, setHomeHeroSubtitle] = useState('Conectamos personas con espacios que transforman su vida. Compra, vende o renta con la asesoría de los mejores especialistas.');
  const [homeHeroImage, setHomeHeroImage] = useState('https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1600');
  const [homeHeroCtaPrimary, setHomeHeroCtaPrimary] = useState('Ver propiedades');
  const [homeHeroCtaSecondary, setHomeHeroCtaSecondary] = useState('Hablar con un asesor');
  const [homeHeroWhatsapp, setHomeHeroWhatsapp] = useState('https://wa.me/524427070872?text=%C2%A1Hola!%20Quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios%20inmobiliarios.');
  const [homeStats, setHomeStats] = useState([
    { value: '500+', label: 'Propiedades activas' },
    { value: '+25',  label: 'Años de experiencia' },
    { value: '1,200+', label: 'Clientes satisfechos' },
    { value: '98%',  label: 'Tasa de cierre' },
  ]);
  const [homeFeatures, setHomeFeatures] = useState([
    { title: 'Venta y Renta',           desc: 'Catálogo actualizado de propiedades residenciales y comerciales en las mejores zonas.' },
    { title: 'Asesoría Personalizada',  desc: 'Nuestros asesores te guían en cada paso del proceso de compra, venta o renta.' },
    { title: 'Valuación de Inmuebles',  desc: 'Estimamos el valor real de tu propiedad con estudios de mercado actualizados.' },
    { title: 'Gestión Rápida',          desc: 'Procesos ágiles, contratos claros y seguimiento puntual para cerrar en el menor tiempo.' },
  ]);
  const [homeWhyEyebrow, setHomeWhyEyebrow] = useState('¿Por qué elegirnos?');
  const [homeWhyTitle, setHomeWhyTitle] = useState('Servicio inmobiliario completo');
  const [homeWhyDesc, setHomeWhyDesc] = useState('Desde la búsqueda hasta la firma, te acompañamos con profesionalismo y transparencia.');
  const [homeFeaturedTitle, setHomeFeaturedTitle] = useState('Encuentra el espacio ideal para ti');
  const [homeFeaturedDesc, setHomeFeaturedDesc] = useState('Explora nuestro catálogo con las mejores opciones en ubicaciones estratégicas, precios competitivos y todo el respaldo de ARE.');
  const [homeFeaturedImage, setHomeFeaturedImage] = useState('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900');
  const [homeCtaTitle, setHomeCtaTitle] = useState('¿Listo para dar el siguiente paso?');
  const [homeCtaDesc, setHomeCtaDesc] = useState('Contáctanos hoy y un asesor especializado te atenderá sin compromiso.');
  const [homeCtaButton, setHomeCtaButton] = useState('Contactar ahora');

  const navItems = [
    { id: 'metrics',  label: 'Metricas',         icon: LayoutDashboard },
    { id: 'leads',    label: 'Leads / CRM',       icon: Inbox },
    { id: 'home',     label: 'Pagina Inicio',     icon: Home },
    { id: 'about',    label: 'Pagina Nosotros',   icon: Users2 },
    { id: 'services', label: 'Servicios',         icon: Wrench },
    { id: 'articles', label: 'Blog / Noticias',   icon: Newspaper },
    { id: 'legal',    label: 'Aviso / Terminos',  icon: FileText },
  ];

  const tabLabels = {
    metrics:  'Metricas y Actividad',
    leads:    'Leads / CRM',
    home:     'Pagina de Inicio',
    about:    'Pagina Nosotros',
    services: 'Gestion de Servicios',
    articles: 'Blog / Noticias',
    legal:    'Documentos Legales',
  };

  return (
    <div className="flex h-screen overflow-hidden bg-isabelline font-body">

      {/* SIDEBAR */}
      <aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden bg-slate-950">

        {/* Logo */}
        <div className="flex shrink-0 items-center justify-center border-b border-white/10 px-5 py-5">
          <img
            src={`${import.meta.env.BASE_URL}color_are.png`}
            alt="ARE Inmobiliaria"
            className="h-20 w-auto object-contain brightness-0 invert"
          />
        </div>

        {/* Usuario */}
        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white font-heading">Administrador</p>
              <p className="text-[11px] text-slate-400">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav - scrollable, takes remaining space */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">Menu</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all font-heading font-semibold ${
                tab === id
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-900/40'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* Sincronizar Tokko - siempre visible */}
        <div className="shrink-0 border-t border-white/10 px-3 py-3">
          <p className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">Tokko Broker</p>
          <button
            type="button"
            onClick={syncTokko}
            disabled={syncing}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50 font-heading"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Tokko'}
          </button>
          {syncMsg && (
            <p className="mt-1.5 text-center text-[10px] leading-snug text-slate-500">{syncMsg}</p>
          )}
        </div>

        {/* Logout - siempre visible */}
        <div className="shrink-0 border-t border-white/10 px-3 py-3">
          <button
            onClick={logout}
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600/20 px-3 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-600 hover:text-white font-heading"
          >
            <LogOut size={15} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Topbar */}
        <header className="shrink-0 flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4 shadow-sm">
          <div>
            <h1 className="font-heading text-xl font-black text-slate-900">{tabLabels[tab]}</h1>
            <p className="mt-0.5 text-xs text-granite capitalize">
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-granite font-heading">Sistema activo</span>
          </div>
        </header>

        {/* Area de contenido con scroll */}
        <main className="flex-1 overflow-y-auto p-8">

          {/* LEADS CRM */}
          {tab === 'leads' && (
            <div className="space-y-5">
              {/* Filtros + acciones */}
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { value: '',           label: 'Todos' },
                  { value: 'new',        label: 'Nuevos' },
                  { value: 'contacted',  label: 'Contactados' },
                  { value: 'closed',     label: 'Cerrados' },
                  { value: 'discarded',  label: 'Descartados' },
                ].map(({ value, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setLeadsStatusFilter(value); loadLeads(value); }}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${leadsStatusFilter === value ? 'bg-brand-500 text-white shadow-sm' : 'border border-gray-200 bg-white text-slate-500 hover:text-slate-800'}`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => loadLeads(leadsStatusFilter)}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  <RefreshCw size={14} />
                  Actualizar
                </button>
              </div>

              {/* Tabla */}
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {leadsLoading ? (
                  <div className="p-10 text-center text-sm text-gray-400">Cargando leads...</div>
                ) : leads.length === 0 ? (
                  <div className="p-10 text-center text-sm text-gray-400">No hay leads{leadsStatusFilter ? ` con estado "${leadsStatusFilter}"` : ''} todavía.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-left">
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Nombre</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Teléfono</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Servicio / Propiedad</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Mensaje</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Fecha</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {leads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-arsenic">{lead.name}</div>
                              <div className="text-xs text-granite">{lead.email || '—'}</div>
                            </td>
                            <td className="px-4 py-3 text-arsenic">{lead.phone || '—'}</td>
                            <td className="px-4 py-3">
                              {lead.service_name
                                ? <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{lead.service_name}</span>
                                : lead.property_id
                                  ? <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Propiedad #{lead.property_id}</span>
                                  : <span className="text-gray-400">—</span>
                              }
                            </td>
                            <td className="max-w-xs px-4 py-3">
                              <p className="line-clamp-2 text-xs text-gray-500">{lead.message || '—'}</p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-granite">
                              {new Date(lead.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={lead.status || 'new'}
                                onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                                className={`rounded-lg border px-2 py-1 text-xs font-semibold transition focus:outline-none cursor-pointer ${
                                  lead.status === 'new'       ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                  lead.status === 'contacted' ? 'border-yellow-200 bg-yellow-50 text-yellow-700' :
                                  lead.status === 'closed'    ? 'border-green-200 bg-green-50 text-green-700' :
                                                                'border-gray-200 bg-gray-50 text-gray-500'
                                }`}
                              >
                                <option value="new">Nuevo</option>
                                <option value="contacted">Contactado</option>
                                <option value="closed">Cerrado</option>
                                <option value="discarded">Descartado</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* METRICAS */}
          {tab === 'metrics' && (
            <div className="space-y-6">

              {/* Propiedades publicas (datos reales de Tokko) */}
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-granite font-heading">Propiedades publicadas</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard title="En el portal" value={metrics?.propStats?.total_public || 0} icon={Home} color="brand" />
                  <MetricCard title="En venta" value={metrics?.propStats?.for_sale || 0} icon={Tag} color="amber" />
                  <MetricCard title="En renta" value={metrics?.propStats?.for_rent || 0} icon={Building2} color="blue" />
                  <MetricCard title="Desarrollos" value={metrics?.totalDevelopments || 0} icon={Building2} color="slate" />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Propiedades por tipo */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-4">
                    <Building2 size={17} className="text-brand-500" />
                    <h3 className="font-heading text-base font-bold text-slate-900">Por tipo de propiedad</h3>
                  </div>
                  <div className="space-y-3">
                    {(metrics?.propByType || []).map((item) => {
                      const max = Math.max(...(metrics?.propByType || []).map((x) => Number(x.total)), 1);
                      const pct = Math.round((Number(item.total) / max) * 100);
                      return (
                        <div key={item.name}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-medium text-arsenic">{item.name}</span>
                            <span className="text-sm font-black text-brand-600">{item.total}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div className="h-1.5 rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {(metrics?.propByType || []).length === 0 && (
                      <p className="text-sm text-granite">Sin datos aun.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-4">
                    <TrendingUp size={17} className="text-brand-500" />
                    <h3 className="font-heading text-base font-bold text-slate-900">Leads por Servicio</h3>
                  </div>
                  <div className="space-y-4">
                    {(metrics?.byService || []).map((item) => {
                      const max = Math.max(...(metrics?.byService || []).map((x) => x.total), 1);
                      const pct = Math.round((item.total / max) * 100);
                      return (
                        <div key={item.name}>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-sm font-medium text-arsenic">{item.name}</span>
                            <span className="text-sm font-black text-brand-600">{item.total}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div className="h-1.5 rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {(metrics?.byService || []).length === 0 && (
                      <p className="text-sm text-granite">Sin datos aun.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-4">
                    <Clock size={17} className="text-brand-500" />
                    <h3 className="font-heading text-base font-bold text-slate-900">Ultimos Leads</h3>
                  </div>
                  <div className="space-y-2">
                    {(metrics?.latest || []).map((lead) => (
                      <div key={lead.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-black text-brand-700 font-heading">
                          {(lead.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-arsenic">{lead.name}</p>
                          <p className="text-xs text-granite">{new Date(lead.created_at).toLocaleString('es-MX')}</p>
                        </div>
                      </div>
                    ))}
                    {(metrics?.latest || []).length === 0 && (
                      <p className="text-sm text-granite">Sin leads recientes.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NOSOTROS */}
          {/* PAGINA INICIO */}
          {tab === 'home' && (
            <div className="max-w-3xl space-y-6">

              {/* Hero */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Home size={16} className="text-brand-500" />
                  Sección Hero (portada)
                </h3>
                <div className="space-y-4">
                  <Field label="Etiqueta superior (badge)">
                    <input className={INPUT} value={homeHeroBadge} onChange={(e) => setHomeHeroBadge(e.target.value)} placeholder="Bienes Raíces — México" />
                  </Field>
                  <Field label="Título principal">
                    <textarea className={INPUT} rows={2} value={homeHeroTitle} onChange={(e) => setHomeHeroTitle(e.target.value)} placeholder="Tu próxima propiedad..." />
                  </Field>
                  <Field label="Subtítulo / descripción">
                    <textarea className={INPUT} rows={3} value={homeHeroSubtitle} onChange={(e) => setHomeHeroSubtitle(e.target.value)} placeholder="Conectamos personas con espacios..." />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Texto botón primario">
                      <input className={INPUT} value={homeHeroCtaPrimary} onChange={(e) => setHomeHeroCtaPrimary(e.target.value)} placeholder="Ver propiedades" />
                    </Field>
                    <Field label="Texto botón secundario">
                      <input className={INPUT} value={homeHeroCtaSecondary} onChange={(e) => setHomeHeroCtaSecondary(e.target.value)} placeholder="Hablar con un asesor" />
                    </Field>
                  </div>
                  <Field label="URL de WhatsApp (botón secundario)">
                    <input className={INPUT} value={homeHeroWhatsapp} onChange={(e) => setHomeHeroWhatsapp(e.target.value)} placeholder="https://wa.me/52..." />
                  </Field>
                  <ImageUpload value={homeHeroImage} onChange={setHomeHeroImage} label="Imagen de fondo del hero" />
                  <button
                    type="button"
                    disabled={saving === 'homeHero'}
                    onClick={async () => {
                      setSaving('homeHero');
                      await Promise.all([
                        api.put('/site-content/home_hero_badge',         { value: homeHeroBadge }),
                        api.put('/site-content/home_hero_title',         { value: homeHeroTitle }),
                        api.put('/site-content/home_hero_subtitle',      { value: homeHeroSubtitle }),
                        api.put('/site-content/home_hero_image',         { value: homeHeroImage }),
                        api.put('/site-content/home_hero_cta_primary',   { value: homeHeroCtaPrimary }),
                        api.put('/site-content/home_hero_cta_secondary', { value: homeHeroCtaSecondary }),
                        api.put('/site-content/home_hero_whatsapp',      { value: homeHeroWhatsapp }),
                      ]);
                      setSaving('');
                    }}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                  >
                    <Save size={14} />
                    {saving === 'homeHero' ? 'Guardando...' : 'Guardar hero'}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <TrendingUp size={16} className="text-brand-500" />
                  Estadísticas (barra de números)
                </h3>
                <div className="space-y-2">
                  {homeStats.map((s, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="w-28 shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-arsenic placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all font-body"
                        placeholder="Valor"
                        value={s.value}
                        onChange={(e) => setHomeStats(prev => prev.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                      />
                      <input
                        className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-arsenic placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all font-body"
                        placeholder="Etiqueta (ej: Años de experiencia)"
                        value={s.label}
                        onChange={(e) => setHomeStats(prev => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                      />
                      <button type="button" onClick={() => setHomeStats(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 rounded-lg p-2 text-granite hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setHomeStats(prev => [...prev, { value: '', label: '' }])} className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-granite hover:border-brand-400 hover:text-brand-500 font-heading">
                      <Plus size={14} /> Agregar
                    </button>
                    <button type="button" disabled={saving === 'homeStats'} onClick={() => saveKey('home_stats', JSON.stringify(homeStats), 'homeStats')} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading">
                      <Save size={14} />
                      {saving === 'homeStats' ? 'Guardando...' : 'Guardar estadísticas'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ¿Por qué elegirnos? */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Sparkles size={16} className="text-brand-500" />
                  Sección "¿Por qué elegirnos?"
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Eyebrow (texto pequeño)">
                      <input className={INPUT} value={homeWhyEyebrow} onChange={(e) => setHomeWhyEyebrow(e.target.value)} placeholder="¿Por qué elegirnos?" />
                    </Field>
                    <Field label="Título">
                      <input className={INPUT} value={homeWhyTitle} onChange={(e) => setHomeWhyTitle(e.target.value)} placeholder="Servicio inmobiliario completo" />
                    </Field>
                  </div>
                  <Field label="Descripción">
                    <textarea className={INPUT} rows={2} value={homeWhyDesc} onChange={(e) => setHomeWhyDesc(e.target.value)} placeholder="Desde la búsqueda hasta la firma..." />
                  </Field>
                  {/* Features list */}
                  <p className="text-[11px] font-bold uppercase tracking-widest text-granite font-heading mt-2">Tarjetas de servicios</p>
                  <div className="space-y-3">
                    {homeFeatures.map((f, i) => (
                      <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            className={`${INPUT} flex-1 font-semibold`}
                            placeholder="Título del servicio"
                            value={f.title}
                            onChange={(e) => setHomeFeatures(prev => prev.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                          />
                          <button type="button" onClick={() => setHomeFeatures(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 rounded-lg p-2 text-granite hover:bg-red-50 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <textarea
                          className={INPUT}
                          rows={2}
                          placeholder="Descripción..."
                          value={f.desc}
                          onChange={(e) => setHomeFeatures(prev => prev.map((x, idx) => idx === i ? { ...x, desc: e.target.value } : x))}
                        />
                      </div>
                    ))}
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setHomeFeatures(prev => [...prev, { title: '', desc: '' }])} className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-granite hover:border-brand-400 hover:text-brand-500 font-heading">
                        <Plus size={14} /> Agregar tarjeta
                      </button>
                    </div>
                  </div>
                  <button type="button" disabled={saving === 'homeWhy'} onClick={async () => {
                    setSaving('homeWhy');
                    await Promise.all([
                      api.put('/site-content/home_why_eyebrow', { value: homeWhyEyebrow }),
                      api.put('/site-content/home_why_title',   { value: homeWhyTitle }),
                      api.put('/site-content/home_why_desc',    { value: homeWhyDesc }),
                      api.put('/site-content/home_features',    { value: JSON.stringify(homeFeatures) }),
                    ]);
                    setSaving('');
                  }} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading">
                    <Save size={14} />
                    {saving === 'homeWhy' ? 'Guardando...' : 'Guardar sección'}
                  </button>
                </div>
              </div>

              {/* Sección destacada */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Star size={16} className="text-brand-500" />
                  Sección "Propiedades Destacadas"
                </h3>
                <div className="space-y-4">
                  <Field label="Título">
                    <input className={INPUT} value={homeFeaturedTitle} onChange={(e) => setHomeFeaturedTitle(e.target.value)} placeholder="Encuentra el espacio ideal para ti" />
                  </Field>
                  <Field label="Descripción">
                    <textarea className={INPUT} rows={3} value={homeFeaturedDesc} onChange={(e) => setHomeFeaturedDesc(e.target.value)} placeholder="Explora nuestro catálogo..." />
                  </Field>
                  <ImageUpload value={homeFeaturedImage} onChange={setHomeFeaturedImage} label="Imagen ilustrativa" />
                  <button type="button" disabled={saving === 'homeFeatured'} onClick={async () => {
                    setSaving('homeFeatured');
                    await Promise.all([
                      api.put('/site-content/home_featured_title', { value: homeFeaturedTitle }),
                      api.put('/site-content/home_featured_desc',  { value: homeFeaturedDesc }),
                      api.put('/site-content/home_featured_image', { value: homeFeaturedImage }),
                    ]);
                    setSaving('');
                  }} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading">
                    <Save size={14} />
                    {saving === 'homeFeatured' ? 'Guardando...' : 'Guardar sección'}
                  </button>
                </div>
              </div>

              {/* Banner CTA */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Zap size={16} className="text-brand-500" />
                  Banner CTA final
                </h3>
                <div className="space-y-4">
                  <Field label="Título">
                    <input className={INPUT} value={homeCtaTitle} onChange={(e) => setHomeCtaTitle(e.target.value)} placeholder="¿Listo para dar el siguiente paso?" />
                  </Field>
                  <Field label="Descripción">
                    <textarea className={INPUT} rows={2} value={homeCtaDesc} onChange={(e) => setHomeCtaDesc(e.target.value)} placeholder="Contáctanos hoy y un asesor..." />
                  </Field>
                  <Field label="Texto del botón">
                    <input className={INPUT} value={homeCtaButton} onChange={(e) => setHomeCtaButton(e.target.value)} placeholder="Contactar ahora" />
                  </Field>
                  <button type="button" disabled={saving === 'homeCta'} onClick={async () => {
                    setSaving('homeCta');
                    await Promise.all([
                      api.put('/site-content/home_cta_title',  { value: homeCtaTitle }),
                      api.put('/site-content/home_cta_desc',   { value: homeCtaDesc }),
                      api.put('/site-content/home_cta_button', { value: homeCtaButton }),
                    ]);
                    setSaving('');
                  }} className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading">
                    <Save size={14} />
                    {saving === 'homeCta' ? 'Guardando...' : 'Guardar banner'}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* PAGINA NOSOTROS */}
          {tab === 'about' && (
            <div className="max-w-3xl space-y-6">

              {/* Hero */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Users2 size={16} className="text-brand-500" />
                  Descripcion e imagen principal
                </h3>
                <div className="space-y-4">
                  <Field label="Parrafo de descripcion">
                    <textarea
                      className={INPUT}
                      rows={4}
                      value={aboutHeroDesc}
                      onChange={(e) => setAboutHeroDesc(e.target.value)}
                      placeholder="Describe la empresa..."
                    />
                  </Field>
                  <ImageUpload value={aboutHeroImage} onChange={setAboutHeroImage} label="Imagen del hero" />
                  <button
                    type="button"
                    disabled={saving === 'hero'}
                    onClick={async () => {
                      setSaving('hero');
                      await Promise.all([
                        api.put('/site-content/about_description', { value: aboutHeroDesc }),
                        api.put('/site-content/about_hero_image', { value: aboutHeroImage }),
                      ]);
                      setSaving('');
                    }}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                  >
                    <Save size={14} />
                    {saving === 'hero' ? 'Guardando...' : 'Guardar descripcion'}
                  </button>
                </div>
              </div>

              {/* Mision y Vision */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Target size={16} className="text-brand-500" />
                  Misión y Visión
                </h3>
                <div className="space-y-4">
                  <Field label="Título de la Misión">
                    <input
                      className={INPUT}
                      placeholder="Ej: Ser el puente entre las personas y su hogar ideal."
                      value={aboutMission.title}
                      onChange={(e) => setAboutMission(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </Field>
                  <Field label="Descripción de la Misión">
                    <textarea
                      className={INPUT}
                      rows={3}
                      placeholder="Describe la misión de la empresa..."
                      value={aboutMission.desc}
                      onChange={(e) => setAboutMission(prev => ({ ...prev, desc: e.target.value }))}
                    />
                  </Field>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={saving === 'mission'}
                      onClick={() => saveKey('about_mission', JSON.stringify(aboutMission), 'mission')}
                      className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                    >
                      <Save size={14} />
                      {saving === 'mission' ? 'Guardando...' : 'Guardar misión'}
                    </button>
                  </div>
                  <Field label="Título de la Visión">
                    <input
                      className={INPUT}
                      placeholder="Ej: Ser la inmobiliaria de referencia en Querétaro."
                      value={aboutVision.title}
                      onChange={(e) => setAboutVision(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </Field>
                  <Field label="Descripción de la Visión">
                    <textarea
                      className={INPUT}
                      rows={3}
                      placeholder="Describe la visión de la empresa..."
                      value={aboutVision.desc}
                      onChange={(e) => setAboutVision(prev => ({ ...prev, desc: e.target.value }))}
                    />
                  </Field>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={saving === 'vision'}
                      onClick={() => saveKey('about_vision', JSON.stringify(aboutVision), 'vision')}
                      className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                    >
                      <Save size={14} />
                      {saving === 'vision' ? 'Guardando...' : 'Guardar visión'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Estadisticas */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <TrendingUp size={16} className="text-brand-500" />
                  Estadisticas de la empresa
                </h3>
                <div className="space-y-2">
                  {aboutFacts.map((fact, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="w-28 shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-arsenic placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all font-body"
                        placeholder="Numero"
                        value={fact.number}
                        onChange={(e) => setAboutFacts(prev => prev.map((f, idx) => idx === i ? { ...f, number: e.target.value } : f))}
                      />
                      <input
                        className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-arsenic placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all font-body"
                        placeholder="Descripcion (ej: Años de trayectoria)"
                        value={fact.label}
                        onChange={(e) => setAboutFacts(prev => prev.map((f, idx) => idx === i ? { ...f, label: e.target.value } : f))}
                      />
                      <button
                        type="button"
                        onClick={() => setAboutFacts(prev => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 rounded-lg p-2 text-granite hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setAboutFacts(prev => [...prev, { number: '', label: '' }])}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-granite hover:border-brand-400 hover:text-brand-500 font-heading"
                    >
                      <Plus size={14} /> Agregar estadistica
                    </button>
                    <button
                      type="button"
                      disabled={saving === 'facts'}
                      onClick={() => saveKey('about_facts', JSON.stringify(aboutFacts), 'facts')}
                      className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                    >
                      <Save size={14} />
                      {saving === 'facts' ? 'Guardando...' : 'Guardar estadisticas'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Equipo */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <User size={16} className="text-brand-500" />
                  Equipo
                </h3>
                <div className="space-y-5">
                  {aboutTeam.map((member, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-arsenic font-heading">{member.name || `Miembro ${i + 1}`}</p>
                        <button
                          type="button"
                          onClick={() => setAboutTeam(prev => prev.filter((_, idx) => idx !== i))}
                          className="rounded-lg p-1.5 text-granite hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nombre">
                          <input
                            className={INPUT}
                            value={member.name}
                            onChange={(e) => setAboutTeam(prev => prev.map((m, idx) => idx === i ? { ...m, name: e.target.value } : m))}
                            placeholder="Nombre completo"
                          />
                        </Field>
                        <Field label="Cargo">
                          <input
                            className={INPUT}
                            value={member.role}
                            onChange={(e) => setAboutTeam(prev => prev.map((m, idx) => idx === i ? { ...m, role: e.target.value } : m))}
                            placeholder="Director, Asesor, etc."
                          />
                        </Field>
                      </div>
                      <Field label="Descripcion">
                        <textarea
                          className={INPUT}
                          rows={2}
                          value={member.bio}
                          onChange={(e) => setAboutTeam(prev => prev.map((m, idx) => idx === i ? { ...m, bio: e.target.value } : m))}
                          placeholder="Breve descripcion del miembro..."
                        />
                      </Field>
                      <ImageUpload
                        value={member.photo}
                        onChange={(url) => setAboutTeam(prev => prev.map((m, idx) => idx === i ? { ...m, photo: url } : m))}
                        label="Foto"
                        fileOnly
                      />
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAboutTeam(prev => [...prev, { name: '', role: '', bio: '', photo: '' }])}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-granite hover:border-brand-400 hover:text-brand-500 font-heading"
                    >
                      <Plus size={14} /> Agregar miembro
                    </button>
                    <button
                      type="button"
                      disabled={saving === 'team'}
                      onClick={() => saveKey('about_team', JSON.stringify(aboutTeam), 'team')}
                      className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                    >
                      <Save size={14} />
                      {saving === 'team' ? 'Guardando...' : 'Guardar equipo'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Historia */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Clock size={16} className="text-brand-500" />
                  Historia de la empresa
                </h3>
                <div className="space-y-2">
                  {aboutTimeline.map((event, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="w-24 shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-arsenic placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all font-body"
                        placeholder="Año"
                        value={event.year}
                        onChange={(e) => setAboutTimeline(prev => prev.map((ev, idx) => idx === i ? { ...ev, year: e.target.value } : ev))}
                      />
                      <input
                        className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-arsenic placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 transition-all font-body"
                        placeholder="Descripcion del hito..."
                        value={event.desc}
                        onChange={(e) => setAboutTimeline(prev => prev.map((ev, idx) => idx === i ? { ...ev, desc: e.target.value } : ev))}
                      />
                      <button
                        type="button"
                        onClick={() => setAboutTimeline(prev => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 rounded-lg p-2 text-granite hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setAboutTimeline(prev => [...prev, { year: '', desc: '' }])}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-granite hover:border-brand-400 hover:text-brand-500 font-heading"
                    >
                      <Plus size={14} /> Agregar evento
                    </button>
                    <button
                      type="button"
                      disabled={saving === 'timeline'}
                      onClick={() => saveKey('about_timeline', JSON.stringify(aboutTimeline), 'timeline')}
                      className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                    >
                      <Save size={14} />
                      {saving === 'timeline' ? 'Guardando...' : 'Guardar historia'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Diferenciadores */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <CheckCircle size={16} className="text-brand-500" />
                  Diferenciadores
                </h3>
                <div className="space-y-2">
                  {aboutDifferentiators.map((item, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Icon picker */}
                        <div className="relative shrink-0">
                          <select
                            value={item.icon || 'CheckCircle'}
                            onChange={(e) => setAboutDifferentiators(prev => prev.map((d, idx) => idx === i ? { ...d, icon: e.target.value } : d))}
                            className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs text-arsenic focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 font-body cursor-pointer"
                          >
                            {DIFF_ICON_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                          {(() => { const Ic = DIFF_ICONS[item.icon] || DIFF_ICONS.CheckCircle; return <Ic size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-500" />; })()}
                        </div>
                        <input
                          className={`${INPUT} flex-1 min-w-0 font-semibold`}
                          placeholder="Titulo del diferenciador"
                          value={item.title}
                          onChange={(e) => setAboutDifferentiators(prev => prev.map((d, idx) => idx === i ? { ...d, title: e.target.value } : d))}
                        />
                        <button
                          type="button"
                          onClick={() => setAboutDifferentiators(prev => prev.filter((_, idx) => idx !== i))}
                          className="shrink-0 rounded-lg p-2 text-granite hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <textarea
                        className={INPUT}
                        rows={2}
                        placeholder="Descripcion..."
                        value={item.desc}
                        onChange={(e) => setAboutDifferentiators(prev => prev.map((d, idx) => idx === i ? { ...d, desc: e.target.value } : d))}
                      />
                    </div>
                  ))}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setAboutDifferentiators(prev => [...prev, { icon: 'CheckCircle', title: '', desc: '' }])}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-granite hover:border-brand-400 hover:text-brand-500 font-heading"
                    >
                      <Plus size={14} /> Agregar diferenciador
                    </button>
                    <button
                      type="button"
                      disabled={saving === 'diff'}
                      onClick={() => saveKey('about_differentiators', JSON.stringify(aboutDifferentiators), 'diff')}
                      className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                    >
                      <Save size={14} />
                      {saving === 'diff' ? 'Guardando...' : 'Guardar diferenciadores'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Brochure */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Download size={16} className="text-brand-500" />
                  Brochure corporativo
                </h3>
                <div className="space-y-4">
                  <Field label="URL del brochure (PDF)">
                    <input
                      className={INPUT}
                      placeholder="https://... o sube un archivo abajo"
                      value={aboutBrochure}
                      onChange={(e) => setAboutBrochure(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-granite hover:border-brand-400 hover:text-brand-500 font-heading">
                      <Upload size={14} />
                      Subir PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          uploadDoc(file, setAboutBrochure);
                        }}
                      />
                    </label>
                    {aboutBrochure && (
                      <a href={aboutBrochure} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-brand-500 underline truncate max-w-xs">
                        Ver brochure actual
                      </a>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={saving === 'brochure'}
                      onClick={() => saveKey('about_brochure', aboutBrochure, 'brochure')}
                      className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                    >
                      <Save size={14} />
                      {saving === 'brochure' ? 'Guardando...' : 'Guardar brochure'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* SERVICIOS */}
          {tab === 'services' && (
            <div className="grid gap-8 lg:grid-cols-2">
              <section
                ref={serviceFormRef}
                className={`rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 ${
                  editingServiceId ? 'border-brand-400 ring-2 ring-brand-100' : 'border-gray-200'
                }`}
              >
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Wrench size={16} className="text-brand-500" />
                  {editingServiceId ? 'Editar Servicio' : 'Nuevo Servicio'}
                </h3>
                <form className="space-y-4" onSubmit={submitService}>
                  <Field label="Nombre del servicio">
                    <input
                      className={INPUT}
                      placeholder="Ej: Venta de propiedades"
                      value={serviceForm.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setServiceForm((prev) => ({
                          ...prev, name,
                          slug: editingServiceId ? prev.slug : toSlug(name),
                        }));
                      }}
                      required
                    />
                  </Field>
                  <Field label="Slug (URL)">
                    <input
                      className={INPUT}
                      placeholder="venta-de-propiedades"
                      value={serviceForm.slug}
                      onChange={(e) => setServiceForm((prev) => ({ ...prev, slug: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Descripcion">
                    <textarea
                      className={INPUT}
                      placeholder="Describe brevemente el servicio..."
                      rows={3}
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </Field>
                  <ImageUpload
                    value={serviceForm.image_url}
                    onChange={(url) => setServiceForm((prev) => ({ ...prev, image_url: url }))}
                    label="Imagen del servicio (opcional)"
                  />
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(serviceForm.active)}
                      onChange={(e) => setServiceForm((prev) => ({ ...prev, active: e.target.checked }))}
                      className="h-4 w-4 rounded accent-brand-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-arsenic font-heading">Servicio activo</span>
                      <p className="text-xs text-granite">Visible en la pagina de servicios</p>
                    </div>
                  </label>
                  <div className="flex gap-3 pt-1">
                    <button
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 font-heading"
                      type="submit"
                    >
                      <Save size={15} />
                      {editingServiceId ? 'Actualizar' : 'Guardar'}
                    </button>
                    {editingServiceId && (
                      <button
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-granite transition hover:bg-gray-50 font-heading"
                        type="button"
                        onClick={cancelEditService}
                      >
                        <X size={15} /> Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4">
                  <h3 className="font-heading text-base font-bold text-slate-900">Servicios</h3>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 font-heading">{services.length}</span>
                </div>
                {services.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center">
                    <Wrench size={26} className="mb-2 text-gray-300" />
                    <p className="text-sm text-granite">Aun no hay servicios.</p>
                  </div>
                ) : (
                  <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                    {services.map((s) => (
                      <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3.5 transition hover:border-brand-100 hover:bg-brand-50/30">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {s.image_url ? (
                            <img src={s.image_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                              <Wrench size={17} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-arsenic font-heading">{s.name}</p>
                            {s.description && (
                              <p className="mt-0.5 truncate text-xs text-granite">{s.description}</p>
                            )}
                            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold font-heading ${
                              s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {s.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => toggleServiceActive(s)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition font-heading ${
                              s.active ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'
                            }`}
                            type="button"
                          >
                            {s.active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => startEditService(s)} className="rounded-lg p-1.5 text-granite hover:bg-blue-50 hover:text-blue-600" type="button" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteService(s.id)} className="rounded-lg p-1.5 text-granite hover:bg-red-50 hover:text-red-600" type="button" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* BLOG */}
          {tab === 'articles' && (
            <div className="grid gap-8 lg:grid-cols-2">
              <section
                ref={formRef}
                className={`rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 ${
                  editingArticleId ? 'border-brand-400 ring-2 ring-brand-100' : 'border-gray-200'
                }`}
              >
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Newspaper size={16} className="text-brand-500" />
                  {editingArticleId ? 'Editar Noticia' : 'Nueva Noticia'}
                </h3>
                <form className="space-y-4" onSubmit={submitArticle}>
                  <Field label="Titulo">
                    <input
                      className={INPUT}
                      placeholder="Titulo de la noticia"
                      value={articleForm.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setArticleForm((prev) => ({
                          ...prev, title,
                          slug: editingArticleId ? prev.slug : toSlug(title),
                        }));
                      }}
                      required
                    />
                  </Field>
                  <Field label="URL externa (opcional)">
                    <input
                      type="url"
                      className={INPUT}
                      placeholder="https://fuente.com/articulo"
                      value={articleForm.external_url}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, external_url: e.target.value }))}
                    />
                  </Field>
                  <Field label="Extracto">
                    <textarea
                      className={INPUT}
                      placeholder="Resumen breve del articulo..."
                      rows={2}
                      value={articleForm.excerpt}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                    />
                  </Field>
                  <Field label="Contenido completo">
                    <textarea
                      className={INPUT}
                      placeholder="Escribe el articulo aqui..."
                      rows={5}
                      value={articleForm.content}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, content: e.target.value }))}
                      required
                    />
                  </Field>
                  <ImageUpload
                    value={articleForm.image_url}
                    onChange={(url) => setArticleForm((prev) => ({ ...prev, image_url: url }))}
                    label="Imagen de portada"
                  />
                  <div className="flex gap-3 pt-1">
                    <button
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 font-heading"
                      type="submit"
                    >
                      <Save size={15} />
                      {editingArticleId ? 'Actualizar' : 'Publicar'}
                    </button>
                    {editingArticleId && (
                      <button
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-granite transition hover:bg-gray-50 font-heading"
                        type="button"
                        onClick={cancelEditArticle}
                      >
                        <X size={15} /> Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4">
                  <h3 className="font-heading text-base font-bold text-slate-900">Articulos</h3>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 font-heading">{articles.length}</span>
                </div>
                {articles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center">
                    <Newspaper size={26} className="mb-2 text-gray-300" />
                    <p className="text-sm text-granite">Aun no hay articulos.</p>
                  </div>
                ) : (
                  <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                    {articles.map((art) => (
                      <div key={art.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3.5 transition hover:border-brand-100 hover:bg-brand-50/30">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {art.image_url ? (
                            <img src={art.image_url} alt={art.title} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                              <Newspaper size={17} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-arsenic font-heading">{art.title}</p>
                            <p className="mt-0.5 text-xs text-granite">{new Date(art.created_at).toLocaleDateString('es-MX')}</p>
                            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold font-heading ${
                              art.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {art.published ? 'Publicado' : 'Borrador'}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => toggleArticlePublished(art)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition font-heading ${
                              art.published ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'
                            }`}
                            type="button"
                          >
                            {art.published ? 'Ocultar' : 'Publicar'}
                          </button>
                          <button onClick={() => startEditArticle(art)} className="rounded-lg p-1.5 text-granite hover:bg-blue-50 hover:text-blue-600" type="button" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteArticle(art.id)} className="rounded-lg p-1.5 text-granite hover:bg-red-50 hover:text-red-600" type="button" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* LEGAL */}
          {tab === 'legal' && (
            <div className="max-w-2xl space-y-6">

              {/* Aviso de privacidad */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <Shield size={16} className="text-brand-500" />
                  Aviso de Privacidad
                </h3>
                <div className="space-y-4">
                  <Field label="URL del aviso (enlace externo o al archivo)">
                    <input
                      type="url"
                      className={INPUT}
                      placeholder="https://ejemplo.com/aviso-de-privacidad"
                      value={legalPrivacy}
                      onChange={(e) => setLegalPrivacy(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-granite font-heading">O sube un PDF:</span>
                    <label className="cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-granite transition hover:border-brand-400 hover:text-brand-500 font-heading">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadDoc(f, setLegalPrivacy);
                        }}
                      />
                      {saving === 'doc' ? 'Subiendo...' : 'Seleccionar PDF'}
                    </label>
                  </div>
                  {legalPrivacy && (
                    <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5">
                      <FileText size={14} className="shrink-0 text-brand-500" />
                      <a href={legalPrivacy} target="_blank" rel="noreferrer" className="truncate text-sm text-brand-600 underline underline-offset-2 font-heading">
                        {legalPrivacy}
                      </a>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={saving === 'privacy'}
                    onClick={() => saveKey('legal_privacy', legalPrivacy, 'privacy')}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                  >
                    <Save size={14} />
                    {saving === 'privacy' ? 'Guardando...' : 'Guardar aviso de privacidad'}
                  </button>
                </div>
              </div>

              {/* Terminos y condiciones */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-heading mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-bold text-slate-900">
                  <FileText size={16} className="text-brand-500" />
                  Terminos y Condiciones
                </h3>
                <div className="space-y-4">
                  <Field label="URL de terminos (enlace externo o al archivo)">
                    <input
                      type="url"
                      className={INPUT}
                      placeholder="https://ejemplo.com/terminos"
                      value={legalTerms}
                      onChange={(e) => setLegalTerms(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-granite font-heading">O sube un PDF:</span>
                    <label className="cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-granite transition hover:border-brand-400 hover:text-brand-500 font-heading">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadDoc(f, setLegalTerms);
                        }}
                      />
                      {saving === 'doc' ? 'Subiendo...' : 'Seleccionar PDF'}
                    </label>
                  </div>
                  {legalTerms && (
                    <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5">
                      <FileText size={14} className="shrink-0 text-brand-500" />
                      <a href={legalTerms} target="_blank" rel="noreferrer" className="truncate text-sm text-brand-600 underline underline-offset-2 font-heading">
                        {legalTerms}
                      </a>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={saving === 'terms'}
                    onClick={() => saveKey('legal_terms', legalTerms, 'terms')}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 font-heading"
                  >
                    <Save size={14} />
                    {saving === 'terms' ? 'Guardando...' : 'Guardar terminos'}
                  </button>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color = 'brand' }) {
  const colors = {
    brand: { bg: 'bg-brand-50', icon: 'text-brand-500', bar: 'bg-brand-500', num: 'text-brand-700' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-500', bar: 'bg-amber-400', num: 'text-amber-700' },
    blue:  { bg: 'bg-blue-50',  icon: 'text-blue-500',  bar: 'bg-blue-500',  num: 'text-blue-700'  },
    green: { bg: 'bg-green-50', icon: 'text-green-600', bar: 'bg-green-500', num: 'text-green-700' },
    slate: { bg: 'bg-slate-100', icon: 'text-slate-500', bar: 'bg-slate-400', num: 'text-slate-700' },
  };
  const c = colors[color] || colors.brand;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`absolute right-4 top-4 rounded-xl ${c.bg} p-2`}>
        <Icon size={19} className={c.icon} />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-granite font-heading">{title}</p>
      <p className={`mt-2 text-3xl font-black font-heading ${c.num}`}>{value}</p>
      <div className={`mt-4 h-1 w-2/3 rounded-full ${c.bar} opacity-25`} />
    </article>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold uppercase tracking-widest text-granite font-heading">{label}</label>
      {children}
    </div>
  );
}