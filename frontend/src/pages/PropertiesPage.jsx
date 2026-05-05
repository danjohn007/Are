import { useEffect, useMemo, useState } from 'react';
import { getAllPaginated } from '../services/api';
import PropertyCard from '../components/PropertyCard';

function normalizeType(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}


export default function PropertiesPage() {
  const [allProperties, setAllProperties] = useState([]);
  const [filter, setFilter] = useState(null);
  const [propertyType, setPropertyType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch ALL properties once — filtering is done client-side for instant response
  useEffect(() => {
    async function fetchProperties() {
      try {
        setLoading(true);
        setError('');
        const data = await getAllPaginated('/properties', { listing_kind: 'property' });
        setAllProperties(data);
      } catch (_error) {
        setAllProperties([]);
        setError('No pudimos cargar propiedades en este momento. Revisa la URL del API en producción.');
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, []); // runs once on mount only

  // Derive available types from the visible subset (respects operation filter)
  const availableTypes = useMemo(() => {
    const seen = new Map();
    const base = filter ? allProperties.filter((p) => p.operation_type === filter) : allProperties;
    for (const p of base) {
      if (p.property_type) {
        const raw = p.property_type.trim();
        const key = normalizeType(raw);
        if (!seen.has(key)) seen.set(key, raw);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [allProperties, filter]);

  const properties = useMemo(() => {
    let result = allProperties;
    if (filter) result = result.filter((p) => p.operation_type === filter);
    if (propertyType) result = result.filter((p) => normalizeType(p.property_type) === normalizeType(propertyType));
    return result;
  }, [allProperties, filter, propertyType]);

  return (
    <section className="section-shell py-14">
      <div className="mb-10 text-center">
        <h2 className="font-heading text-4xl font-black text-brand-500">Propiedades</h2>
        <p className="mt-2 text-gray-600">Catálogo completo de propiedades en venta y renta con información verificada.</p>
      </div>

      <div className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-gray-100 bg-white px-6 py-4 shadow-sm">
        {/* Icono + etiqueta */}
        <div className="flex items-center gap-2 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-[0.15em]">Filtros</span>
        </div>

        <div className="h-5 w-px bg-gray-200 hidden sm:block" />

        {/* Operación */}
        <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
          {[{ value: null, label: 'Todos' }, { value: 'venta', label: 'En Venta' }, { value: 'renta', label: 'En Renta' }].map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => { setFilter(value); setPropertyType(''); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                filter === value
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tipo de propiedad — valores directos de Tokko */}
        {availableTypes.length > 0 && (
          <>
            <div className="h-5 w-px bg-gray-200 hidden sm:block" />
            <div className="relative">
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-4 pr-9 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 cursor-pointer"
              >
                <option value="">Tipo de propiedad</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </>
        )}

        {/* Contador */}
        <span className="ml-auto text-sm text-slate-400">
          {properties.length} resultado{properties.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">
          Cargando propiedades...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
          {error}
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
          No hay propiedades para los filtros seleccionados.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </section>
  );
}
