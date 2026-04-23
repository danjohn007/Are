import { useEffect, useState } from 'react';
import api from '../services/api';
import ArticleCard from '../components/ArticleCard';

export default function NewsPage() {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    async function fetchArticles() {
      const response = await api.get('/articles?limit=30&page=1');
      setArticles(response.data.data);
    }

    fetchArticles();
  }, []);

  return (
    <section className="section-shell py-14">
      <div className="mb-10 text-center">
        <h2 className="font-heading text-4xl font-black text-slate-950">BLOG</h2>
        <p className="mt-2 text-gray-600">Las últimas novedades del mercado inmobiliario y consejos de nuestro equipo de expertos.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
