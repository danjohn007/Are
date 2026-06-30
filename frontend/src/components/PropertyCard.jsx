import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Maximize2 } from 'lucide-react';

function toPositiveNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = toPositiveNumber(value);
    if (number > 0) return number;
  }
  return 0;
}

export default function PropertyCard({ property }) {
  const operationBadgeColor = property.operation_type === 'renta' ? 'bg-emerald-500' : 'bg-brand-500';
  const operationLabel = property.operation_type === 'renta' ? 'En Renta' : 'En Venta';
  const detailPath = property.listing_kind === 'development' ? `/developments/${property.id}` : `/properties/${property.id}`;
  const price = toPositiveNumber(property.price);
  const formattedPrice = price > 0 ? `$${price.toLocaleString('es-MX')}` : 'Consultar';
  const area = firstPositiveNumber(property.area, property.details?.total_surface, property.details?.roofed_surface, property.details?.private_area);
  const bedrooms = toPositiveNumber(property.bedrooms);
  const bathrooms = toPositiveNumber(property.bathrooms);
  const displayLocation = property.display_location || property.details?.display_location || property.location_full || property.address || property.city || '';

  const facts = [
    area > 0 ? { key: 'area', icon: Maximize2, label: `${area.toLocaleString('es-MX')} m²` } : null,
    bedrooms > 0 ? { key: 'bedrooms', icon: BedDouble, label: `${bedrooms} Rec.` } : null,
    bathrooms > 0 ? { key: 'bathrooms', icon: Bath, label: `${bathrooms} Baños` } : null,
  ].filter(Boolean);

  return (
    <article data-aos="zoom-in" className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="relative overflow-hidden">
        <Link to={detailPath} aria-label={`Ver detalle de ${property.title}`}>
          <img
            src={property.image_url || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be'}
            alt={property.title}
            loading="lazy"
            decoding="async"
            className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-slate-950/0 transition-all duration-300 group-hover:bg-slate-950/40 flex items-center justify-center">
            <span className="translate-y-4 scale-90 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg">
              Ver detalle →
            </span>
          </div>
        </Link>
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white shadow ${operationBadgeColor}`}>
          {operationLabel}
        </span>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/80 to-transparent px-4 py-3">
          <span className="text-xl font-black text-white tracking-tight">{formattedPrice}</span>
          {price > 0 && <span className="ml-1 text-xs text-white/70">MXN</span>}
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-heading text-base font-bold leading-snug text-slate-900">
          <Link to={detailPath} className="transition hover:text-brand-600">
            {property.title || 'Propiedad sin título'}
          </Link>
        </h3>
        <p className="mt-2 flex items-start gap-1 text-xs leading-5 text-gray-500">
          <MapPin size={11} className="mt-1 shrink-0 text-brand-400" />
          <span>{displayLocation || 'Ubicación no disponible'}</span>
        </p>

        {facts.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
            {facts.map(({ key, icon: Icon, label }) => (
              <span key={key} className="flex items-center gap-1.5">
                <Icon size={13} className="text-gray-400" />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
};