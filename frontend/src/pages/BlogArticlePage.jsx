import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import ArticleCard from '../components/ArticleCard';

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function estimateReadingTime(article) {
  const raw = `${article?.title || ''} ${article?.excerpt || ''} ${article?.content || ''}`.trim();
  const words = raw ? raw.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 220));
}

function inferCategory(article) {
  const text = `${article?.title || ''} ${article?.excerpt || ''}`.toLowerCase();
  if (/inversion|rentabilidad|roi|capital/.test(text)) return 'Inversion';
  if (/compra|venta|hipoteca|credito/.test(text)) return 'Guia';
  if (/zona|colonia|ciudad|mercado|plusvalia/.test(text)) return 'Mercado';
  if (/legal|fiscal|impuesto|contrato|notaria/.test(text)) return 'Legal';
  return 'Tendencias';
}

function splitContent(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const byLine = content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (byLine.length >= 2) {
    return byLine;
  }

  return content
    .split(/\.\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.endsWith('.') ? item : `${item}.`));
}

function buildOutline(paragraphs) {
  return paragraphs
    .filter((paragraph) => paragraph.length > 30)
    .slice(0, 5)
    .map((paragraph) => {
      const words = paragraph.split(/\s+/).slice(0, 8).join(' ');
      return words.endsWith('.') ? words : `${words}...`;
    });
}

export default function BlogArticlePage() {
  const { slug } = useParams();
  const [articles, setArticles] = useState([]);
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true);
        setError('');

        const response = await api.get('/articles?limit=120&page=1');
        const items = Array.isArray(response?.data?.data) ? response.data.data : [];
        setArticles(items);

        const found = items.find((item) => item.slug === slug);
        if (!found) {
          setError('No encontramos este artículo.');
          setArticle(null);
          return;
        }

        setArticle(found);
      } catch (_error) {
        setError('No pudimos cargar este artículo en este momento.');
      } finally {
        setLoading(false);
      }
    }

    fetchArticles();
  }, [slug]);

  const paragraphs = useMemo(() => splitContent(article?.content || ''), [article]);
  const outline = useMemo(() => buildOutline(paragraphs), [paragraphs]);
  const related = useMemo(() => {
    if (!article) return [];
    const currentCategory = inferCategory(article);
    return articles
      .filter((item) => item.id !== article.id)
      .sort((a, b) => {
        const aScore = inferCategory(a) === currentCategory ? 1 : 0;
        const bScore = inferCategory(b) === currentCategory ? 1 : 0;
        return bScore - aScore;
      })
      .slice(0, 3);
  }, [article, articles]);

  if (loading) {
    return (
      <section className="section-shell py-14">
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-600">
          Cargando artículo...
        </div>
      </section>
    );
  }

  if (error || !article) {
    return (
      <section className="section-shell py-14">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center text-red-700">
          {error || 'No encontramos este artículo.'}
          <div className="mt-5">
            <Link to="/blog" className="inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Volver al blog
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section-shell py-14">
      <div className="mb-6">
        <Link to="/blog" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          ← Volver al blog
        </Link>
      </div>

      <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <img
          src={article.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1800'}
          alt={article.title}
          className="h-72 w-full object-cover md:h-[28rem]"
        />

        <div className="mx-auto max-w-4xl px-6 py-10 md:px-10 md:py-12">
          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
            <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-800">{inferCategory(article)}</span>
            <span className="text-slate-500">{formatDate(article.created_at)}</span>
            <span className="text-slate-500">{estimateReadingTime(article)} min lectura</span>
          </div>

          <h1 className="mt-4 font-heading text-4xl font-black leading-tight text-slate-950 md:text-5xl">{article.title}</h1>
          <p className="mt-4 text-lg text-slate-600">{article.excerpt || 'Análisis claro para tomar mejores decisiones inmobiliarias.'}</p>

          {outline.length > 0 && (
            <aside className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">En este artículo</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {outline.map((point, index) => (
                  <li key={point}>{index + 1}. {point}</li>
                ))}
              </ul>
            </aside>
          )}

          <div className="prose mt-9 max-w-none text-slate-700">
            {(paragraphs.length ? paragraphs : [article.content]).map((paragraph, index) => (
              <p key={`${article.id}-paragraph-${index}`} className="mb-5 whitespace-pre-line text-base leading-8">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-slate-950 px-6 py-8 text-white">
            <h3 className="font-heading text-2xl font-black text-white">¿Quieres aplicar esto a tu próxima compra o inversión?</h3>
            <p className="mt-2 max-w-2xl text-white/90">Te ayudamos a seleccionar zonas, analizar plusvalía y filtrar propiedades según tu objetivo real.</p>
            <Link to="/contact" className="mt-5 inline-flex rounded-xl bg-brand-500 px-6 py-3 font-bold text-white transition hover:bg-brand-700">
              Hablar con un asesor ahora
            </Link>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-3xl font-black text-slate-950">Artículos relacionados</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
