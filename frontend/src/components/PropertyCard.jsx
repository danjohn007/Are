export default function PropertyCard({ property }) {
  const operationBadgeColor = property.operation_type === 'renta' ? 'bg-green-500' : 'bg-orange-500';
  const operationLabel = property.operation_type === 'renta' ? 'En Renta' : 'En Venta';
  
  return (
    <article data-aos="zoom-in" className="relative overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition hover:shadow-lg">
      <div className="relative">
        <img
          src={property.image_url || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be'}
          alt={property.title}
          className="h-56 w-full object-cover"
        />
        <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white ${operationBadgeColor}`}>
          {operationLabel}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-heading text-lg font-bold">{property.title}</h3>
        <p className="mt-1 text-sm text-gray-500">{property.city}</p>
        <p className="mt-3 line-clamp-2 text-sm text-gray-700">{property.description}</p>
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-brand-600">${Number(property.price || 0).toLocaleString('es-MX')} MXN</span>
          </div>
          <div className="flex gap-4 text-xs text-gray-600">
            <span>📍 {property.area} m²</span>
            <span>🛏️ {property.bedrooms} Recámaras</span>
            <span>🚿 {property.bathrooms} Baños</span>
          </div>
        </div>
      </div>
    </article>
  );
}
