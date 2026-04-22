import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';

const initialProperty = { title: '', description: '', price: 0, address: '', city: '', bedrooms: 0, bathrooms: 0, area: 0, image_url: '', operation_type: 'venta' };
const initialService = { name: '', slug: '', description: '', price: 0 };
const initialArticle = { title: '', slug: '', excerpt: '', content: '', image_url: '' };

export default function DashboardPage() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('metrics');
  const [metrics, setMetrics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [services, setServices] = useState([]);
  const [articles, setArticles] = useState([]);
  const [propertyForm, setPropertyForm] = useState(initialProperty);
  const [serviceForm, setServiceForm] = useState(initialService);
  const [articleForm, setArticleForm] = useState(initialArticle);
  const [selectedLead, setSelectedLead] = useState(null);

  async function loadData() {
    const [m, l, pr, s, a] = await Promise.all([
      api.get('/dashboard/metrics'),
      api.get('/leads?limit=20&page=1'),
      api.get('/properties?limit=20&page=1'),
      api.get('/services?limit=20&page=1'),
      api.get('/articles?limit=20&page=1')
    ]);

    setMetrics(m.data.data);
    setLeads(l.data.data);
    setProperties(pr.data.data);
    setServices(s.data.data);
    setArticles(a.data.data);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createProperty(event) {
    event.preventDefault();
    await api.post('/properties', propertyForm);
    setPropertyForm(initialProperty);
    await loadData();
  }

  async function deleteProperty(id) {
    if (window.confirm('¿Eliminar esta propiedad?')) {
      await api.delete(`/properties/${id}`);
      await loadData();
    }
  }

  async function createService(event) {
    event.preventDefault();
    await api.post('/services', serviceForm);
    setServiceForm(initialService);
    await loadData();
  }

  async function deleteService(id) {
    if (window.confirm('¿Eliminar este servicio?')) {
      await api.delete(`/services/${id}`);
      await loadData();
    }
  }

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

  async function updateLeadStatus(id, status) {
    const current = leads.find((lead) => lead.id === id);
    if (!current) return;

    await api.put(`/leads/${id}`, {
      ...current,
      status,
      email: current.email,
      phone: current.phone
    });
    await loadData();
  }

  const tabs = [
      { id: 'metrics', label: '📊 Métricas' },
    { id: 'leads', label: '📋 Solicitudes' },
    { id: 'properties', label: '🏠 Propiedades' },
    { id: 'services', label: '⚙️ Servicios' },
    { id: 'articles', label: '📰 Noticias' }
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

      {/* Métricas Tab */}
      {tab === 'metrics' && (
        <div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard title="Total Leads" value={metrics?.totals?.total || 0} icon="📬" />
            <MetricCard title="Nuevos" value={metrics?.totals?.new_count || 0} icon="✨" />
            <MetricCard title="Contactados" value={metrics?.totals?.contacted_count || 0} icon="☎️" />
            <MetricCard title="Cerrados" value={metrics?.totals?.closed_count || 0} icon="✅" />
            <MetricCard title="Propiedades" value={metrics?.totals?.total_properties || 0} icon="🏠" />
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

      {/* Solicitudes Tab */}
      {tab === 'leads' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lista */}
          <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-6 py-4">
              <h3 className="font-heading text-xl font-bold">Solicitudes de Información</h3>
              <p className="text-xs text-gray-500 mt-1">{leads.length} solicitudes recibidas</p>
            </div>
            <div className="divide-y max-h-[70vh] overflow-y-auto">
              {leads.length === 0 && (
                <p className="px-6 py-8 text-center text-gray-400">No hay solicitudes todavía.</p>
              )}
              {leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`w-full text-left px-6 py-4 hover:bg-orange-50 transition-colors flex items-center gap-4 ${
                    selectedLead?.id === lead.id ? 'bg-orange-50 border-l-4 border-brand-500' : ''
                  }`}
                  type="button"
                >
                  <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                    {lead.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{lead.name}</p>
                    <p className="text-xs text-gray-500 truncate">{lead.service_name || 'Sin servicio'}</p>
                    <p className="text-xs text-gray-400">{new Date(lead.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <StatusBadge status={lead.status} />
                </button>
              ))}
            </div>
          </section>

          {/* Detalle */}
          <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            {!selectedLead ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center text-gray-400">
                <span className="text-5xl mb-4">👆</span>
                <p className="font-semibold">Selecciona una solicitud</p>
                <p className="text-sm mt-1">para ver sus detalles</p>
              </div>
            ) : (
              <>
                <div className="border-b bg-gray-50 px-6 py-4 flex items-center justify-between">
                  <h3 className="font-heading text-lg font-bold">Detalle de Solicitud</h3>
                  <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-700 text-xl font-bold" type="button">✕</button>
                </div>
                <div className="p-6 space-y-4">
                  {/* Avatar + nombre */}
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-black text-xl">
                      {selectedLead.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-lg text-slate-900">{selectedLead.name}</p>
                      <StatusBadge status={selectedLead.status} />
                    </div>
                  </div>

                  <hr />

                  {/* Datos de contacto */}
                  <div className="grid gap-3">
                    <DetailRow icon="📧" label="Correo" value={selectedLead.email || '—'} />
                    <DetailRow icon="📱" label="Teléfono" value={selectedLead.phone || '—'} />
                    <DetailRow icon="⚙️" label="Servicio" value={selectedLead.service_name || '—'} />
                    <DetailRow icon="🗓️" label="Fecha" value={new Date(selectedLead.created_at).toLocaleString('es-MX')} />
                    {selectedLead.message && (
                      <div className="rounded-lg bg-gray-50 border p-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">💬 Mensaje</p>
                        <p className="text-sm text-slate-700">{selectedLead.message}</p>
                      </div>
                    )}
                  </div>

                  <hr />

                  {/* Cambiar estado */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Actualizar estado</p>
                    <div className="flex gap-2 flex-wrap">
                      {[['new', '✨ Nuevo'], ['contacted', '☎️ Contactado'], ['closed', '✅ Cerrado']].map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={async () => {
                            await updateLeadStatus(selectedLead.id, val);
                            setSelectedLead((prev) => ({ ...prev, status: val }));
                          }}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold border transition-colors ${
                            selectedLead.status === val
                              ? 'bg-brand-500 text-white border-brand-500'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Acciones rápidas */}
                  <div className="flex gap-2 pt-2">
                    {selectedLead.email && (
                      <a href={`mailto:${selectedLead.email}`} className="flex-1 text-center rounded-lg bg-slate-800 text-white py-2 text-sm font-semibold hover:bg-slate-900">
                        📧 Enviar correo
                      </a>
                    )}
                    {selectedLead.phone && (
                      <a href={`tel:${selectedLead.phone}`} className="flex-1 text-center rounded-lg bg-brand-500 text-white py-2 text-sm font-semibold hover:bg-brand-600">
                        📞 Llamar
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Propiedades Tab */}
      {tab === 'properties' && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">Crear Propiedad</h3>
            <form className="space-y-4" onSubmit={createProperty}>
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Título"
                value={propertyForm.title}
                onChange={(e) => setPropertyForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                className="w-full rounded-lg border p-3"
                placeholder="Descripción"
                rows={3}
                value={propertyForm.description}
                onChange={(e) => setPropertyForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded-lg border p-3"
                  placeholder="Precio"
                  type="number"
                  value={propertyForm.price}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                  required
                />
                <input
                  className="rounded-lg border p-3"
                  placeholder="Ciudad"
                  value={propertyForm.city}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, city: e.target.value }))}
                  required
                />
              </div>
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Dirección"
                value={propertyForm.address}
                onChange={(e) => setPropertyForm((prev) => ({ ...prev, address: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  className="rounded-lg border p-3"
                  placeholder="Recámaras"
                  type="number"
                  value={propertyForm.bedrooms}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, bedrooms: Number(e.target.value) }))}
                />
                <input
                  className="rounded-lg border p-3"
                  placeholder="Baños"
                  type="number"
                  value={propertyForm.bathrooms}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, bathrooms: Number(e.target.value) }))}
                />
                <input
                  className="rounded-lg border p-3"
                  placeholder="m²"
                  type="number"
                  value={propertyForm.area}
                  onChange={(e) => setPropertyForm((prev) => ({ ...prev, area: Number(e.target.value) }))}
                />
              </div>
              <select
                className="w-full rounded-lg border p-3"
                value={propertyForm.operation_type}
                onChange={(e) => setPropertyForm((prev) => ({ ...prev, operation_type: e.target.value }))}
              >
                <option value="venta">🏷️ En Venta</option>
                <option value="renta">🔑 En Renta</option>
              </select>
              <ImageUpload
                value={propertyForm.image_url}
                onChange={(url) => setPropertyForm((prev) => ({ ...prev, image_url: url }))}
                label="Imagen de la propiedad"
              />
              <button className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white hover:bg-brand-600" type="submit">
                💾 Guardar Propiedad
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">Propiedades ({properties.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {properties.map((prop) => (
                <div key={prop.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{prop.title}</p>
                    <p className="text-xs text-gray-600">{prop.city}</p>
                    <p className="text-xs font-bold text-brand-600">${Number(prop.price).toLocaleString('es-MX')} MXN</p>
                  </div>
                  <button
                    onClick={() => deleteProperty(prop.id)}
                    className="text-red-500 hover:text-red-700 font-bold"
                    type="button"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Servicios Tab */}
      {tab === 'services' && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">Crear Servicio</h3>
            <form className="space-y-4" onSubmit={createService}>
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Nombre del servicio"
                value={serviceForm.name}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Slug (url-amigable)"
                value={serviceForm.slug}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, slug: e.target.value }))}
                required
              />
              <textarea
                className="w-full rounded-lg border p-3"
                placeholder="Descripción"
                rows={4}
                value={serviceForm.description}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border p-3"
                placeholder="Precio"
                type="number"
                value={serviceForm.price}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                required
              />
              <button className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white hover:bg-brand-600" type="submit">
                💾 Guardar Servicio
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">Servicios ({services.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {services.map((svc) => (
                <div key={svc.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{svc.name}</p>
                    <p className="text-xs text-brand-600">${Number(svc.price).toLocaleString('es-MX')} MXN</p>
                  </div>
                  <button
                    onClick={() => deleteService(svc.id)}
                    className="text-red-500 hover:text-red-700 font-bold"
                    type="button"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Noticias Tab */}
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
              <button className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white hover:bg-brand-600" type="submit">
                💾 Guardar Noticia
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold mb-4">Noticias ({articles.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {articles.map((art) => (
                <div key={art.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{art.title}</p>
                    <p className="text-xs text-gray-500">{new Date(art.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                  <button
                    onClick={() => deleteArticle(art.id)}
                    className="text-red-500 hover:text-red-700 font-bold"
                    type="button"
                  >
                    🗑️
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

function MetricCard({ title, value, icon }) {
  return (
    <article className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
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

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg w-6 text-center shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 font-medium">{value}</p>
      </div>
    </div>
  );
}
