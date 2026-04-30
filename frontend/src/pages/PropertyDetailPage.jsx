import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import PropertyCard from '../components/PropertyCard';

const fallbackImage = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be';

function formatValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') {
    return 'No disponible';
  }

  return `${value}${suffix}`;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatAreaInBestUnit(value) {
  const area = toNumber(value);
  if (!area) {
    return 'No disponible';
  }
  if (area >= 10000) {
    return `${(area / 10000).toLocaleString('es-MX', { maximumFractionDigits: 3 })} ha`;
  }
  return `${area.toLocaleString('es-MX')} m²`;
}

function parseGeo(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  useEffect(() => {
    async function fetchItem() {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/properties/${id}`);
        const nextItem = response.data.data || null;
        setItem(nextItem);
        setActiveIndex(0);
        setShowFullDescription(false);
      } catch (_error) {
        setError('No pudimos cargar este registro.');
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  useEffect(() => {
    if (!item || item.listing_kind !== 'development') return;
    let cancelled = false;
    async function fetchUnits() {
      setLoadingUnits(true);
      try {
        const res = await api.get(`/properties/${id}/units`);
        if (!cancelled) setUnits(res.data.data || []);
      } catch {
        if (!cancelled) setUnits([]);
      } finally {
        if (!cancelled) setLoadingUnits(false);
      }
    }
    fetchUnits();
    return () => { cancelled = true; };
  }, [item, id]);

  if (loading) {
    return (
      <section className="section-shell py-16">
        <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          Cargando detalle...
        </div>
      </section>
    );
  }

  if (error || !item) {
    return (
      <section className="section-shell py-16">
        <div className="rounded-3xl border border-red-100 bg-red-50 p-10 text-center text-red-700 shadow-sm">
          {error || 'No encontramos este registro.'}
        </div>
      </section>
    );
  }

  const isDevelopment = item.listing_kind === 'development';
  const badgeClass = isDevelopment ? 'bg-brand-500 text-white' : item.operation_type === 'renta' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white';
  const badgeLabel = isDevelopment ? 'Desarrollo' : item.operation_type === 'renta' ? 'En Renta' : 'En Venta';
  const backPath = isDevelopment ? '/developments' : '/properties';
  const backLabel = isDevelopment ? 'Volver a desarrollos' : 'Volver a propiedades';
  const photos = item.photos?.length ? item.photos : [{ image: item.image_url || fallbackImage, original: item.image_url || fallbackImage, thumb: item.image_url || fallbackImage }];
  const normalizedActiveIndex = Math.min(activeIndex, Math.max(photos.length - 1, 0));
  const activePhoto = photos[normalizedActiveIndex] || photos[0];
  const activeImage = activePhoto?.original || activePhoto?.image || item.image_url || fallbackImage;
  const goToPreviousImage = () => setActiveIndex((current) => (current === 0 ? photos.length - 1 : current - 1));
  const goToNextImage = () => setActiveIndex((current) => (current === photos.length - 1 ? 0 : current + 1));
  const geoLat = parseGeo(item.details?.geo_lat);
  const geoLong = parseGeo(item.details?.geo_long);
  const mapUrl = geoLat !== null && geoLong !== null ? `https://www.google.com/maps?q=${geoLat},${geoLong}&z=15&output=embed` : null;
  const mapLink = geoLat !== null && geoLong !== null ? `https://www.google.com/maps?q=${geoLat},${geoLong}` : null;
  const pricePerM2 = item.details?.price_per_m2 || (toNumber(item.price) > 0 && toNumber(item.area) > 0 ? (toNumber(item.price) / toNumber(item.area)).toFixed(2) : null);
  const displayPrice = toNumber(item.price) > 0 ? `$${toNumber(item.price).toLocaleString('es-MX')} MXN` : 'Consultar precio';
  const shortDescription = (item.description || '').slice(0, 600);

  const detailEntries = [
    ['Tipo', item.property_type],
    ['Referencia', item.reference_code],
    ['Operacion', badgeLabel],
    ['Ubicacion', item.location_full || item.address || item.city],
    ['Direccion', item.address],
    ['Codigo postal', item.details?.zip_code],
    ['Superficie total', formatValue(Number(item.area || item.details?.total_surface || 0).toLocaleString('es-MX'), ' m²')],
    ['Superficie techada', item.details?.roofed_surface ? `${Number(item.details.roofed_surface).toLocaleString('es-MX')} m²` : null],
    ['Superficie sin techar', item.details?.unroofed_surface ? `${Number(item.details.unroofed_surface).toLocaleString('es-MX')} m²` : null],
    ['Area privada', item.details?.private_area ? `${Number(item.details.private_area).toLocaleString('es-MX')} m²` : null],
    ['Estacionamientos', item.details?.parking_lot_amount],
    ['Recamaras', item.bedrooms],
    ['Banos', item.bathrooms],
    ['Condicion', item.details?.property_condition],
    ['Situacion', item.details?.situation],
    ['Antiguedad', item.details?.age],
    ['Fecha de construccion', item.details?.construction_date],
    ['Gastos / mantenimiento', item.details?.expenses ? `$${Number(item.details.expenses).toLocaleString('es-MX')} MXN` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== '0');

  const generalInfo = [
    ['Zonificacion', item.details?.zonification],
    ['Antiguedad', item.details?.age],
    ['$ x m²', pricePerM2 ? `$${toNumber(pricePerM2).toLocaleString('es-MX')}` : null],
    ['Forma de terreno', item.details?.disposition],
    ['Topografia', item.details?.orientation],
    ['Credito elegible', item.details?.credit_eligible],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  const surfaces = [
    ['Terreno', formatAreaInBestUnit(item.area || item.details?.total_surface)],
    ['Fondo', item.details?.depth_measure ? `${toNumber(item.details.depth_measure).toLocaleString('es-MX')} m` : null],
    ['Frente', item.details?.front_measure ? `${toNumber(item.details.front_measure).toLocaleString('es-MX')} m` : null],
    ['Techada', item.details?.roofed_surface ? `${toNumber(item.details.roofed_surface).toLocaleString('es-MX')} m²` : null],
    ['Sin techar', item.details?.unroofed_surface ? `${toNumber(item.details.unroofed_surface).toLocaleString('es-MX')} m²` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== 'No disponible');

  return (
    <section className="section-shell py-14 lg:py-16">
      <Link to={backPath} className="mb-6 inline-flex text-sm font-semibold text-brand-700 transition hover:text-brand-500">
        {backLabel}
      </Link>

      <div className="grid items-start gap-8 lg:grid-cols-2 xl:gap-10">
        <div className="space-y-6 lg:space-y-7">
        <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-slate-100">
            <img
              src={activeImage}
              alt={item.title}
              className="h-[320px] w-full object-cover md:h-[440px] transition-opacity duration-300"
            />

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPreviousImage}
                  aria-label="Imagen anterior"
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-slate-900 shadow-lg transition hover:bg-white"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goToNextImage}
                  aria-label="Imagen siguiente"
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-slate-900 shadow-lg transition hover:bg-white"
                >
                  ›
                </button>
                {/* Counter badge */}
                <span className="absolute bottom-4 right-4 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-semibold text-white">
                  {normalizedActiveIndex + 1} / {photos.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
              {photos.map((photo, index) => {
                const thumb = photo.thumb || photo.image || photo.original;
                const isActive = index === normalizedActiveIndex;
                return (
                  <button
                    key={`thumb-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                      isActive ? 'border-brand-500 opacity-100 scale-105' : 'border-transparent opacity-60 hover:opacity-90'
                    }`}
                  >
                    <img
                      src={thumb}
                      alt={`Foto ${index + 1}`}
                      className="h-16 w-20 object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-6 p-6 md:p-7">
            {detailEntries.length > 0 && (
              <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="font-heading text-xl font-bold text-slate-950">Detalles de la propiedad</h2>
                <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-5 text-sm text-gray-700 sm:grid-cols-2">
                  {detailEntries.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {generalInfo.length > 0 && (
              <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="font-heading text-xl font-bold text-slate-950">Informacion general</h2>
                <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-5 text-sm text-gray-700 sm:grid-cols-2">
                  {generalInfo.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

        </div>

        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
          <h2 className="font-heading text-xl font-bold text-slate-950">Descripcion</h2>
          <p className="mt-3 whitespace-pre-line text-base leading-7 text-gray-700">
            {showFullDescription ? (item.description || 'Sin descripcion disponible por el momento.') : (shortDescription || 'Sin descripcion disponible por el momento.')}
          </p>
          {(item.description || '').length > 600 && (
            <button
              type="button"
              onClick={() => setShowFullDescription((v) => !v)}
              className="mt-3 text-sm font-semibold text-brand-700 transition hover:text-brand-500"
            >
              {showFullDescription ? 'Mostrar menos' : 'Mostrar mas'}
            </button>
          )}
        </section>

        {item.tags?.length > 0 && (
          <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
            <h2 className="font-heading text-xl font-bold text-slate-950">
              {isDevelopment ? 'Adicionales' : 'Amenidades y caracteristicas'}
            </h2>
            {isDevelopment ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {item.tags.map((tag) => (
                  <li key={tag} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-slate-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold">✓</span>
                    {tag}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {mapUrl && (
          <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-bold text-slate-950">Ubicacion</h3>
              {mapLink && (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-brand-700 transition hover:text-brand-500"
                >
                  Abrir en Google Maps
                </a>
              )}
            </div>
            <iframe
              title="Mapa de ubicacion"
              src={mapUrl}
              className="h-72 w-full rounded-2xl border border-gray-200"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Nota importante: las medidas e informacion se consideran referenciales y deben validarse con documentacion vigente.
            </p>
          </section>
        )}

        </div>

        <div className="space-y-6 lg:space-y-7">
          <div className="rounded-[2rem] border border-gray-100 bg-white p-7 shadow-sm md:p-8">
            <span className={`inline-flex rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] ${badgeClass}`}>
              {badgeLabel}
            </span>
            <h1 className="mt-5 font-heading text-3xl font-black text-slate-950 md:text-4xl">{item.title}</h1>
            <p className="mt-3 text-base text-gray-500">{item.address || item.city || 'Ubicacion no disponible'}</p>

            {item.location_full && item.location_full !== item.address && (
              <p className="mt-2 text-sm text-gray-500">{item.location_full}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="rounded-full bg-gray-100 px-4 py-2">Ciudad: {item.city || 'No disponible'}</span>
              <span className="rounded-full bg-gray-100 px-4 py-2">Terreno: {Number(item.area || 0).toLocaleString('es-MX')} m²</span>
              <span className="rounded-full bg-gray-100 px-4 py-2">Recamaras: {item.bedrooms || 0}</span>
              <span className="rounded-full bg-gray-100 px-4 py-2">Banos: {item.bathrooms || 0}</span>
            </div>

            <div className="mt-8 rounded-2xl bg-slate-950 px-6 py-5 text-white">
              <p className="text-xs uppercase tracking-[0.3em] text-white/85">Precio</p>
              <p className="mt-2 text-3xl font-black text-white">
                {displayPrice}
              </p>
            </div>

            {item.details?.public_url && (
              <a
                href={item.details.public_url}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Ver ficha original
              </a>
            )}

            <Link
              to={`/contact?property_id=${item.id}&property_title=${encodeURIComponent(item.title || 'esta propiedad')}`}
              className="mt-4 inline-flex rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-700"
            >
              Solicitar informacion
            </Link>
          </div>

          {(item.details?.branch?.name || item.details?.branch?.email || item.details?.branch?.phone || item.details?.branch?.address) && (
            <aside className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
              <h3 className="font-heading text-xl font-bold text-slate-950">Contacto</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                {item.details?.branch?.name && <p className="font-semibold text-slate-900">{item.details.branch.name}</p>}
                {item.details?.branch?.email && <p>{item.details.branch.email}</p>}
                {item.details?.branch?.phone && <p>{item.details.branch.phone}</p>}
                {item.details?.branch?.contact_time && <p>{item.details.branch.contact_time}</p>}
                {item.details?.branch?.address && <p>{item.details.branch.address}</p>}
              </div>
            </aside>
          )}

          {/* Development-specific block */}
          {isDevelopment && (
            <div className="rounded-[2rem] border-2 border-brand-100 bg-brand-50 p-6 md:p-7">
              <h2 className="font-heading text-xl font-bold text-slate-950 mb-4">Información del desarrollo</h2>
              <div className="flex flex-wrap gap-4">
                {(item.details?.unit_amount || item.details?.available_units) && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-xl font-black text-white">
                      {item.details?.available_units || item.details?.unit_amount}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Unidades</p>
                      <p className="font-bold text-slate-900">disponibles</p>
                    </div>
                  </div>
                )}
                {item.details?.floors_amount && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl font-black text-white">
                      {item.details.floors_amount}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pisos</p>
                      <p className="font-bold text-slate-900">en el edificio</p>
                    </div>
                  </div>
                )}
                {item.details?.construction_status && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Estado</p>
                      <p className="font-bold text-slate-900">{item.details.construction_status}</p>
                    </div>
                  </div>
                )}
                {item.details?.delivery_date && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fecha de entrega</p>
                      <p className="font-bold text-slate-900">{item.details.delivery_date}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Units list for developments */}
          {isDevelopment && (loadingUnits || units.length > 0) && (
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
              <h2 className="font-heading text-xl font-bold text-slate-950 mb-1">Unidades disponibles</h2>
              {loadingUnits ? (
                <p className="mt-4 text-sm text-gray-400">Cargando unidades...</p>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-5">{units.length} unidad{units.length !== 1 ? 'es' : ''} en este desarrollo</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {units.map((unit) => (
                      <PropertyCard key={unit.id} property={unit} />
                    ))}
                  </div>
                </>
              )}
            </section>
          )}



          {surfaces.length > 0 && (
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
              <h2 className="font-heading text-xl font-bold text-slate-950">Superficies y medidas</h2>
              <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-5 text-sm text-gray-700 sm:grid-cols-2">
                {surfaces.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}



          {item.videos?.length > 0 && (
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
              <h2 className="font-heading text-xl font-bold text-slate-950">Videos</h2>
              <div className="mt-4 space-y-3">
                {item.videos.map((video) => (
                  <a
                    key={video.id || video.url}
                    href={video.url || video.player_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
                  >
                    {video.title || 'Ver video'}
                  </a>
                ))}
              </div>
            </section>
          )}

          {item.files?.length > 0 && (
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
              <h2 className="font-heading text-xl font-bold text-slate-950">Archivos</h2>
              <div className="mt-4 space-y-3">
                {item.files.map((file, index) => (
                  <a
                    key={file.file || index}
                    href={file.file}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Documento {index + 1}
                  </a>
                ))}
              </div>
            </section>
          )}


        </div>
      </div>
    </section>
  );
}