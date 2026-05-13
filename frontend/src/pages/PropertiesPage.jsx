import { useEffect, useMemo, useState } from 'react';
import { getAllPaginated } from '../services/api';
import PropertyCard from '../components/PropertyCard';

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function stateFrom(locationFull) {
  if (!locationFull) return '';
  const parts = locationFull.split('|');
  return (parts[1] ?? '').trim();
}

function coloniaFrom(locationFull) {
  if (!locationFull) return '';
  const parts = locationFull.split('|');
  return (parts[parts.length - 1] ?? '').trim();
}

const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export default function PropertiesPage() {
  const [allProperties, setAllProperties] = useState([]);
  const [opFilter, setOpFilter]       = useState(null);
  const [typeFilter, setTypeFilter]   = useState('');
  const [zonaFilter, setZonaFilter]   = useState('');
  const [coloniaFilter, setColoniaFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    async function fetchProperties() {
      try {
        setLoading(true);
        setError('');
        const data = await getAllPaginated('/properties', { listing_kind: 'property' });
        setAllProperties(data);
      } catch {
        setAllProperties([]);
        setError('No pudimos cargar propiedades en este momento. Revisa la URL del API en producción.');
      } finally {
        setLoading(false);
      }
    }
    fetchProperties();
  }, []);

  // Base subset after operation filter
  const baseSubset = useMemo(() =>
    opFilter ? allProperties.filter(p => p.operation_type === opFilter) : allProperties,
  [allProperties, opFilter]);

  const availableTypes = useMemo(() => {
    const seen = new Map();
    for (const p of baseSubset) {
      if (p.property_type) {
        const key = normalize(p.property_type);
        if (!seen.has(key)) seen.set(key, p.property_type.trim());
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseSubset]);

  const availableZonas = useMemo(() => {
    const seen = new Set();
    for (const p of baseSubset) {
      const state = stateFrom(p.location_full);
      if (state) seen.add(state);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseSubset]);

  // Colonias filtered by zona selection too
  const availableColonias = useMemo(() => {
    const seen = new Set();
    const base = zonaFilter ? baseSubset.filter(p => normalize(stateFrom(p.location_full)) === normalize(zonaFilter)) : baseSubset;
    for (const p of base) {
      const col = coloniaFrom(p.location_full);
      if (col) seen.add(col);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseSubset, zonaFilter]);

  const properties = useMemo(() => {
    let result = baseSubset;
    if (typeFilter)    result = result.filter(p => normalize(p.property_type) === normalize(typeFilter));
    if (zonaFilter)    result = result.filter(p => normalize(stateFrom(p.location_full)) === normalize(zonaFilter));
    if (coloniaFilter) result = result.filter(p => normalize(coloniaFrom(p.location_full)) === normalize(coloniaFilter));
    return result;
  }, [baseSubset, typeFilter, zonaFilter, coloniaFilter]);

  const resetDependentFilters = () => { setZonaFilter(''); setColoniaFilter(''); setTypeFilter(''); };

  return (
    <section className="section-shell py-8">
      <div className="mb-5 text-center">
        <h2 className="font-heading text-3xl font-black text-brand-500">Propiedades</h2>
        <p className="mt-1 text-sm text-gray-500">Catálogo completo de propiedades en venta y renta con información verificada.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-3 rounded-2xl border border-gray-100 bg-white px-5 py-3 shadow-sm">
        {/* Label */}
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
              onClick={() => { setOpFilter(value); resetDependentFilters(); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
                opFilter === value ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200 hidden sm:block" />

        {/* Tipo de inmueble */}
        {availableTypes.length > 0 && (
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 cursor-pointer"
            >
              <option value="">Tipo de inmueble</option>
              {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown />
          </div>
        )}

        {/* Zona */}
        {availableZonas.length > 0 && (
          <div className="relative">
            <select
              value={zonaFilter}
              onChange={(e) => { setZonaFilter(e.target.value); setColoniaFilter(''); }}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 cursor-pointer"
            >
              <option value="">Estado</option>
              {availableZonas.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <ChevronDown />
          </div>
        )}

        {/* Colonia */}
        {availableColonias.length > 0 && (
          <div className="relative">
            <select
              value={coloniaFilter}
              onChange={(e) => setColoniaFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 cursor-pointer"
            >
              <option value="">Colonia / Fracc.</option>
              {availableColonias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown />
          </div>
        )}

        {/* Limpiar filtros */}
        {(typeFilter || zonaFilter || coloniaFilter || opFilter) && (
          <button
            type="button"
            onClick={() => { setOpFilter(null); resetDependentFilters(); }}
            className="text-xs text-granite underline hover:text-brand-500 transition"
          >
            Limpiar
          </button>
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
