import { Link } from 'react-router-dom';

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function estimateReadingTime(article) {
  const raw = `${article?.title || ''} ${article?.excerpt || ''} ${article?.content || ''}`.trim();
  const words = raw ? raw.split(/\s+/).length : 0;
  const mins = Math.max(1, Math.ceil(words / 220));
  return `${mins} min lectura`;
}

function inferCategory(article) {
  const text = `${article?.title || ''} ${article?.excerpt || ''}`.toLowerCase();
  if (/inversion|rentabilidad|roi|capital/.test(text)) return 'Inversion';
  if (/compra|venta|hipoteca|credito/.test(text)) return 'Guia';
  if (/zona|colonia|ciudad|mercado|plusvalia/.test(text)) return 'Mercado';
  if (/legal|fiscal|impuesto|contrato|notaria/.test(text)) return 'Legal';
  return 'Tendencias';
}

export default function ArticleCard({ article }) {
  const category = inferCategory(article);
  const slug = article?.slug || String(article?.id || 'articulo');

  return (
    <article
      data-aos="fade-up"
      className="group overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <Link to={`/blog/${slug}`}>
        <div className="relative">
          <img
            src={article.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200'}
            alt={article.title}
            className="h-52 w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {category}
          </span>
        </div>

        <div className="p-6">
          <h3 className="font-heading text-xl font-black leading-snug text-slate-900">{article.title}</h3>
          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{article.excerpt || 'Descubre recomendaciones prácticas del mercado inmobiliario.'}</p>
          <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
            <span>{formatDate(article.created_at)}</span>
            <span>{estimateReadingTime(article)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
