import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import {
  Inbox, Sparkles, Phone, CheckCircle, Home,
  Trash2, Save, Pencil, X, RefreshCw, Wrench
} from 'lucide-react';

const initialArticle = { title: '', slug: '', excerpt: '', content: '', image_url: '', external_url: '', published: true };
const initialService = { name: '', slug: '', description: '', price: '', image_url: '', active: true };

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

  async function syncTokko() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await api.post('/properties/sync/tokko');
      const count = res.data?.data?.synced ?? '?';
      setSyncMsg(`✅ Sincronización completada — ${count} propiedades actualizadas.`);
    } catch {
      setSyncMsg('❌ Error al sincronizar. Intenta nuevamente.');
    } finally {
      setSyncing(false);
    }
  }

  async function loadData() {
    const [m, a] = await Promise.all([
      api.get('/dashboard/metrics'),
      api.get('/articles?limit=50&page=1&all=1')
    ]);

    setMetrics(m.data.data);
    setArticles(a.data.data);
  }

  async function loadServices() {
    const res = await api.get('/services?limit=50&page=1&all=1');
    setServices(res.data.data || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tab === 'services') loadServices();
  }, [tab]);

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
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function cancelEditArticle() {
    setEditingArticleId(null);
    setArticleForm(initialArticle);
  }

  async function deleteArticle(id) {
    if (window.confirm('¿Eliminar este artículo?')) {
      await api.delete(`/articles/${id}`);
      await loadData();
    }
  }

  async function submitService(event) {
    event.preventDefault();
    const payload = { ...serviceForm, price: parseFloat(serviceForm.price) || 0 };
    if (editingServiceId) {
      await api.put(`/services/${editingServiceId}`, payload);
    } else {
      await api.post('/services', payload);
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
      price: s.price || '',
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
    if (window.confirm('¿Eliminar este servicio?')) {
      await api.delete(`/services/${id}`);
      await loadServices();
    }
  }

  async function toggleServiceActive(s) {
    await api.put(`/services/${s.id}`, {
      name: s.name,
      slug: s.slug,
      description: s.description,
      price: s.price,
      image_url: s.image_url,
      active: !s.active,
    });
    await loadServices();
  }

  async function toggleArticlePublished(art) {
    await api.put(`/articles/${art.id}`, {
      title: art.title,
      slug: art.slug,
      excerpt: art.excerpt,
      content: art.content,
      image_url: art.image_url,
      external_url: art.external_url,
      published: !art.published,
    });
    await loadData();
  }

  const tabs = [
    { id: 'metrics', label: '📊 Métricas' },
    { id: 'services', label: '🛠️ Servicios' },
    { id: 'articles', label: '📰 BLOG' }
  ];

  return (
    <section className="section-shell py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-black text-slate-950">Panel Administrativo</h1>
        <button className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100" onClick={logout} type="button">
          🚪 Cerrar sesión
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 flex gap-2 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 px-4 font-semibold transition whitespace-nowrap ${
              tab === t.id
                ? 'border-b-2 border-brand-500 text-brand-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>Solicitudes, Propiedades y Servicios se administran en Tokko Broker.</span>
        <button
          type="button"
          onClick={syncTokko}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-60"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Tokko'}
        </button>
      </div>
      {syncMsg && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          {syncMsg}
        </div>
      )}

      {/* Métricas Tab */}
      {tab === 'metrics' && (
        <div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard title="Total Leads" value={metrics?.totals?.total || 0} icon={Inbox} />
            <MetricCard title="Nuevos" value={metrics?.totals?.new_count || 0} icon={Sparkles} />
            <MetricCard title="Contactados" value={metrics?.totals?.contacted_count || 0} icon={Phone} />
            <MetricCard title="Cerrados" value={metrics?.totals?.closed_count || 0} icon={CheckCircle} />
            <MetricCard title="Propiedades" value={metrics?.totals?.total_properties || 0} icon={Home} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="font-heading text-xl font-bold">Leads por Servicio</h3>
              <div className="mt-4 space-y-3">
                {(metrics?.byService || []).map((item) => (
                  <div key={item.name} className="flex items-center justify-between border-b pb-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-lg font-bold text-brand-600">{item.total}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="font-heading text-xl font-bold">Últimos Leads</h3>
              <div className="mt-4 space-y-3">
                {(metrics?.latest || []).map((lead) => (
                  <div key={lead.id} className="rounded-lg border p-3">
                    <p className="font-semibold">{lead.name}</p>
                    <p className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleString('es-MX')}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Servicios Tab */}
      {tab === 'services' && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Formulario crear/editar */}
          <section
            ref={serviceFormRef}
            className={`rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 ${
              editingServiceId ? 'border-brand-400 ring-2 ring-brand-200' : ''
            }`}
          >
            <h3 className="font-heading text-xl font-bold mb-4 flex items-center gap-2">
              <Wrench size={20} className="text-brand-500" />
              {editingServiceId ? 'Editar Servicio' : 'Crear Servicio'}
            </h3>
            <form className="space-y-4" onSubmit={submitService}>
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Nombre del servicio"
                value={serviceForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setServiceForm((prev) => ({
                    ...prev,
                    name,
                    slug: editingServiceId ? prev.slug : toSlug(name),
                  }));
                }}
                required
              />
              <input
                className="w-full rounded-lg border p-3 text-sm text-gray-500"
                placeholder="Slug (auto-generado)"
                value={serviceForm.slug}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, slug: e.target.value }))}
                required
              />
              <textarea
                className="w-full rounded-lg border p-3"
                placeholder="Descripción del servicio"
                rows={3}
                value={serviceForm.description}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border p-3"
                placeholder="Precio (MXN) — 0 si es a consultar"
                value={serviceForm.price}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                required
              />
              <ImageUpload
                value={serviceForm.image_url}
                onChange={(url) => setServiceForm((prev) => ({ ...prev, image_url: url }))}
                label="Imagen del servicio (opcional)"
              />
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={Boolean(serviceForm.active)}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, active: e.target.checked }))}
                  className="h-4 w-4 rounded accent-brand-500"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-700">Servicio activo</span>
                  <p className="text-xs text-gray-400">Visible en la página de servicios</p>
                </div>
              </label>
              <div className="flex gap-3">
                <button
                  className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white hover:bg-brand-600 flex items-center justify-center gap-2"
                  type="submit"
                >
                  <Save size={17} /> {editingServiceId ? 'Actualizar Servicio' : 'Guardar Servicio'}
                </button>
                {editingServiceId && (
                  <button
                    className="rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                    type="button"
                    onClick={cancelEditService}
                  >
                    <X size={17} /> Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Lista de servicios */}
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">Servicios ({services.length})</h3>
            {services.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no hay servicios. Crea el primero con el formulario.</p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto">
                {services.map((s) => (
                  <div key={s.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-sm">{s.name}</p>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {s.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ${Number(s.price || 0).toLocaleString('es-MX')} MXN
                      </p>
                      {s.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{s.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <button
                        onClick={() => toggleServiceActive(s)}
                        className={`rounded-lg border px-2 py-1 text-xs font-bold transition ${
                          s.active
                            ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                            : 'border-green-300 text-green-700 hover:bg-green-50'
                        }`}
                        type="button"
                      >
                        {s.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => startEditService(s)}
                        className="text-blue-500 hover:text-blue-700"
                        type="button"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => deleteService(s.id)}
                        className="text-red-500 hover:text-red-700"
                        type="button"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* BLOG Tab */}
      {tab === 'articles' && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section
            ref={formRef}
            className={`rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 ${
              editingArticleId ? 'border-blue-400 ring-2 ring-blue-200' : ''
            }`}
          >
            <h3 className="font-heading text-xl font-bold mb-4">
              {editingArticleId ? 'Editar Noticia' : 'Crear Noticia'}
            </h3>
            <form className="space-y-4" onSubmit={submitArticle}>
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Título"
                value={articleForm.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setArticleForm((prev) => ({
                    ...prev,
                    title,
                    slug: editingArticleId ? prev.slug : toSlug(title),
                  }));
                }}
                required
              />
              <input
                type="url"
                className="w-full rounded-lg border p-3 text-sm"
                placeholder="URL externa (opcional, ej: https://fuente.com/articulo)"
                value={articleForm.external_url}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, external_url: e.target.value }))}
              />
              <textarea
                className="w-full rounded-lg border p-3"
                placeholder="Extracto"
                rows={2}
                value={articleForm.excerpt}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, excerpt: e.target.value }))}
              />
              <textarea
                className="w-full rounded-lg border p-3"
                placeholder="Contenido completo"
                rows={5}
                value={articleForm.content}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, content: e.target.value }))}
                required
              />
              <ImageUpload
                value={articleForm.image_url}
                onChange={(url) => setArticleForm((prev) => ({ ...prev, image_url: url }))}
                label="Imagen de portada"
              />
              <div className="flex gap-3">
                <button className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white hover:bg-brand-600 flex items-center justify-center gap-2" type="submit">
                  <Save size={17} /> {editingArticleId ? 'Actualizar Noticia' : 'Guardar Noticia'}
                </button>
                {editingArticleId && (
                  <button
                    className="rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                    type="button"
                    onClick={cancelEditArticle}
                  >
                    <X size={17} /> Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">BLOG ({articles.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {articles.map((art) => (
                <div key={art.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">{art.title}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        art.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {art.published ? 'Publicado' : 'Borrador'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{new Date(art.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleArticlePublished(art)}
                      className={`rounded-lg border px-2 py-1 text-xs font-bold transition ${
                        art.published
                          ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                          : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                      type="button"
                    >
                      {art.published ? 'Ocultar' : 'Publicar'}
                    </button>
                    <button
                      onClick={() => startEditArticle(art)}
                      className="text-blue-500 hover:text-blue-700"
                      type="button"
                      title="Editar"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => deleteArticle(art.id)}
                      className="text-red-500 hover:text-red-700"
                      type="button"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function MetricCard({ title, value, icon: Icon }) {
  return (
    <article className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <span className="text-brand-500"><Icon size={28} /></span>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  const map = {
    new: 'bg-orange-100 text-orange-700',
    contacted: 'bg-blue-100 text-blue-700',
    closed: 'bg-green-100 text-green-700',
  };
  const labels = { new: 'Nuevo', contacted: 'Contactado', closed: 'Cerrado' };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-6 shrink-0 text-gray-400 mt-0.5"><Icon size={18} /></span>
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 font-medium">{value}</p>
      </div>
    </div>
  );
}
