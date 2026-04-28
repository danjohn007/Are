import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ArticleCard from '../components/ArticleCard';

function inferCategory(article) {
  const text = `${article?.title || ''} ${article?.excerpt || ''}`.toLowerCase();
  if (/inversion|rentabilidad|roi|capital/.test(text)) return 'Inversion';
  if (/compra|venta|hipoteca|credito/.test(text)) return 'Guia';
  if (/zona|colonia|ciudad|mercado|plusvalia/.test(text)) return 'Mercado';
  if (/legal|fiscal|impuesto|contrato|notaria/.test(text)) return 'Legal';
  return 'Tendencias';
}

function estimateReadingTime(article) {
  const raw = `${article?.title || ''} ${article?.excerpt || ''} ${article?.content || ''}`.trim();
  const words = raw ? raw.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 220));
}

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/articles?limit=60&page=1');
        setArticles(Array.isArray(response?.data?.data) ? response.data.data : []);
      } catch (_error) {
        setError('No pudimos cargar el blog en este momento. Intenta nuevamente en unos minutos.');
        setArticles([]);
      } finally {
        setLoading(false);
      }
    }

    fetchArticles();
  }, []);

  const categories = ['Todos', ...new Set(articles.map((article) => inferCategory(article)))];
  const featured = articles[0] || null;

  const filtered = articles.filter((article) => {
    const category = inferCategory(article);
    const haystack = `${article?.title || ''} ${article?.excerpt || ''}`.toLowerCase();
    const categoryOk = activeCategory === 'Todos' || category === activeCategory;
    const searchOk = !search.trim() || haystack.includes(search.trim().toLowerCase());
    return categoryOk && searchOk;
  });

  return (
    <section className="section-shell py-14">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-orange-900 px-7 py-10 text-white md:px-10 md:py-12">
        <div className="pointer-events-none absolute -right-10 -top-8 h-44 w-44 rounded-full bg-orange-400/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-10 h-36 w-36 rounded-full bg-amber-200/20 blur-2xl" />

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">ARE Journal</p>
        <h2 className="mt-3 max-w-2xl font-heading text-4xl font-black leading-tight text-white md:text-5xl">Blog inmobiliario para comprar mejor e invertir con visión</h2>
        <p className="mt-4 max-w-2xl text-sm text-white/90 md:text-base">
          Publicaciones con análisis de mercado, zonas con potencial, guías legales y estrategias para tomar decisiones con datos.
        </p>

        <div className="mt-7 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Busca por tema: plusvalía, compra, renta, inversión..."
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/70 focus:border-white/50 focus:outline-none"
          />
          <Link to="/contact" className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-orange-50">
            Hablar con un asesor
          </Link>
        </div>
      </div>

      {featured && (
        <article className="mt-8 grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-2">
          <img
            src={featured.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1400'}
            alt={featured.title}
            className="h-72 w-full object-cover lg:h-full"
          />
          <div className="p-7 md:p-9">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">Artículo destacado</p>
            <h3 className="mt-3 font-heading text-3xl font-black leading-snug text-slate-950">{featured.title}</h3>
            <p className="mt-4 text-slate-600">{featured.excerpt || 'Análisis y recomendaciones para tomar mejores decisiones inmobiliarias.'}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span>{inferCategory(featured)}</span>
              <span>{estimateReadingTime(featured)} min lectura</span>
            </div>
            <Link
              to={`/blog/${featured.slug || featured.id}`}
              className="mt-7 inline-flex rounded-xl bg-slate-950 px-6 py-3 font-bold text-white transition hover:bg-slate-800"
            >
              Leer artículo completo
            </Link>
          </div>
        </article>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeCategory === category
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-900'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">Cargando artículos...</div>
      ) : error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
          No encontramos artículos con esos filtros. Prueba otra categoría o palabra clave.
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      <div className="mt-12 rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
        <h3 className="font-heading text-2xl font-black text-slate-950">¿Quieres convertir esta información en una decisión real?</h3>
        <p className="mx-auto mt-2 max-w-2xl text-slate-600">Te ayudamos a aterrizar zonas, presupuesto y estrategia de compra o inversión según tu objetivo.</p>
        <Link to="/contact" className="mt-5 inline-flex rounded-xl bg-brand-500 px-7 py-3 font-bold text-white transition hover:bg-brand-700">
          Solicitar asesoría personalizada
        </Link>
      </div>
    </section>
  );
}
