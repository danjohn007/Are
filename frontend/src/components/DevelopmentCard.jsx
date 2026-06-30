import { Link } from 'react-router-dom';
import { MapPin, Building2, Layers, ArrowRight } from 'lucide-react';

export default function DevelopmentCard({ development }) {
  const detailPath = `/developments/${development.id}`;
  const price = Number(development.price || 0);
  const formattedPrice = price > 0 ? `$${price.toLocaleString('es-MX')} MXN` : 'Consultar precio';
  const units = development.details?.available_units || development.details?.unit_amount;
  const floors = development.details?.floors_amount;
  const tags = development.tags || [];

  return (
    <article
      data-aos="fade-up"
      className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col"
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        <Link to={detailPath} aria-label={`Ver detalle de ${development.title}`}>
          <img
            src={development.image_url || 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200'}
            alt={development.title}
            loading="lazy"
            decoding="async"
            className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105 md:h-72"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-slate-950/0 transition-all duration-300 group-hover:bg-slate-950/35 flex items-center justify-center">
            <span className="translate-y-4 scale-90 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg">
              Ver desarrollo <ArrowRight size={15} />
            </span>
          </div>
        </Link>

        {/* Top badges */}
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white shadow">
            Desarrollo
          </span>
          {development.operation_type === 'renta' && (
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow">
              En Renta
            </span>
          )}
        </div>

        {/* Price gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/85 to-transparent px-5 py-4">
          <p className="text-2xl font-black text-white tracking-tight">{formattedPrice}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-heading text-xl font-black text-slate-950 leading-snug line-clamp-2">
          <Link to={detailPath} className="transition hover:text-brand-600">
            {development.title}
          </Link>
        </h3>

        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin size={13} className="shrink-0 text-brand-400" />
          {development.city || development.address || 'Ubicación no disponible'}
        </p>

        {development.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">
            {development.description}
          </p>
        )}

        {/* Stats pills */}
        {(units || floors || development.area > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {units && (
              <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
                <Building2 size={12} /> {units} unidades
              </span>
            )}
            {floors && (
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                <Layers size={12} /> {floors} pisos
              </span>
            )}
            {development.area > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                {Number(development.area).toLocaleString('es-MX')} m²
              </span>
            )}
          </div>
        )}

        {/* Tags preview */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                {tag}
              </span>
            ))}
            {tags.length > 4 && (
              <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                +{tags.length - 4} más
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pt-5">
          <Link
            to={detailPath}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-sm font-bold text-white transition hover:bg-brand-500"
          >
            Ver desarrollo completo <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
