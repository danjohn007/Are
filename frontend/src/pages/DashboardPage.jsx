import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import {
  Inbox, Sparkles, Phone, CheckCircle, Home,
  Trash2, Save
} from 'lucide-react';

const initialArticle = { title: '', slug: '', excerpt: '', content: '', image_url: '' };

export default function DashboardPage() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('metrics');
  const [metrics, setMetrics] = useState(null);
  const [articles, setArticles] = useState([]);
  const [articleForm, setArticleForm] = useState(initialArticle);

  async function loadData() {
    const [m, a] = await Promise.all([
      api.get('/dashboard/metrics'),
      api.get('/articles?limit=20&page=1')
    ]);

    setMetrics(m.data.data);
    setArticles(a.data.data);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createArticle(event) {
    event.preventDefault();
    await api.post('/articles', articleForm);
    setArticleForm(initialArticle);
    await loadData();
  }

  async function deleteArticle(id) {
    if (window.confirm('¿Eliminar este artículo?')) {
      await api.delete(`/articles/${id}`);
      await loadData();
    }
  }

  const tabs = [
    { id: 'metrics', label: '📊 Métricas' },
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

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Solicitudes, Propiedades y Servicios se administran en Tokko Broker.
      </div>

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

      {/* BLOG Tab */}
      {tab === 'articles' && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">Crear Noticia</h3>
            <form className="space-y-4" onSubmit={createArticle}>
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Título"
                value={articleForm.title}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Slug (url-amigable)"
                value={articleForm.slug}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, slug: e.target.value }))}
                required
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
              <button className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white hover:bg-brand-600 flex items-center justify-center gap-2" type="submit">
                <Save size={17} /> Guardar Noticia
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">BLOG ({articles.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {articles.map((art) => (
                <div key={art.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{art.title}</p>
                    <p className="text-xs text-gray-500">{new Date(art.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <button
                    onClick={() => deleteArticle(art.id)}
                    className="text-red-500 hover:text-red-700"
                    type="button"
                  >
                    <Trash2 size={18} />
                  </button>
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
