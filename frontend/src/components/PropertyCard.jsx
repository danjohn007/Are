import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Maximize2 } from 'lucide-react';

export default function PropertyCard({ property }) {
  const operationBadgeColor = property.operation_type === 'renta' ? 'bg-emerald-500' : 'bg-brand-500';
  const operationLabel = property.operation_type === 'renta' ? 'En Renta' : 'En Venta';
  const detailPath = property.listing_kind === 'development' ? `/developments/${property.id}` : `/properties/${property.id}`;
  const price = Number(property.price || 0);
  const formattedPrice = price > 0 ? `$${price.toLocaleString('es-MX')}` : 'Consultar';

  return (
    <article data-aos="zoom-in" className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* Image with overlay */}
      <div className="relative overflow-hidden">
        <Link to={detailPath} aria-label={`Ver detalle de ${property.title}`}>
          <img
            src={property.image_url || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be'}
            alt={property.title}
            className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Dark overlay on hover */}
          <div className="absolute inset-0 bg-slate-950/0 transition-all duration-300 group-hover:bg-slate-950/40 flex items-center justify-center">
            <span className="translate-y-4 scale-90 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg">
              Ver detalle →
            </span>
          </div>
        </Link>
        {/* Badge */}
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white shadow ${operationBadgeColor}`}>
          {operationLabel}
        </span>
        {/* Price pill on image bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/80 to-transparent px-4 py-3">
          <span className="text-xl font-black text-white tracking-tight">{formattedPrice}</span>
          {price > 0 && <span className="ml-1 text-xs text-white/70">MXN</span>}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-heading text-base font-bold leading-snug text-slate-900 line-clamp-2">
          <Link to={detailPath} className="transition hover:text-brand-600">
            {property.title}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <MapPin size={11} className="shrink-0 text-brand-400" />
          {property.city || 'Ubicación no disponible'}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><Maximize2 size={13} className="text-gray-400" />{property.area ? `${Number(property.area).toLocaleString('es-MX')} m²` : '—'}</span>
          <span className="flex items-center gap-1.5"><BedDouble size={13} className="text-gray-400" />{property.bedrooms || 0} Rec.</span>
          <span className="flex items-center gap-1.5"><Bath size={13} className="text-gray-400" />{property.bathrooms || 0} Baños</span>
        </div>
      </div>
    </article>
  );
}

