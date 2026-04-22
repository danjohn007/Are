export default function ArticleCard({ article }) {
  const formatDate = (date) => new Date(date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  
  return (
    <article data-aos="fade-up" className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition hover:shadow-lg">
      <img
        src={article.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400'}
        alt={article.title}
        className="h-48 w-full object-cover"
      />
      <div className="p-6">
        <h3 className="font-heading text-lg font-bold text-gray-900">{article.title}</h3>
        <p className="mt-3 line-clamp-2 text-sm text-gray-700">{article.excerpt}</p>
        <p className="mt-4 text-xs text-gray-400">{formatDate(article.created_at)}</p>
      </div>
    </article>
  );
}
