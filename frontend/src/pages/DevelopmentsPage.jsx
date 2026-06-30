import { useEffect, useMemo, useState } from 'react';
import { getAllPaginated, readListCache, writeListCache } from '../services/api';
import DevelopmentCard from '../components/DevelopmentCard';

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

function clearOldDevelopmentsListCaches(currentKey) {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('are:public:developments:') && key !== currentKey)
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Sin sessionStorage seguimos sin cache local.
  }
}

const OPERATION_LABELS = {
  venta: 'En Venta',
  renta: 'En Renta',
  alquiler: 'En Renta',
  'alquiler temporario': 'Alquiler temporal',
  venta_y_alquiler: 'Venta y Alquiler',
};

export default function DevelopmentsPage() {
  const [allDevelopments, setAllDevelopments] = useState([]);
  const [operacion, setOperacion]   = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [zonaFilter, setZonaFilter] = useState('');
  const [coloniaFilter, setColoniaFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let mounted = true;
    const cacheKey = 'are:public:developments:v7-are-real-estate-visible';
    clearOldDevelopmentsListCaches(cacheKey);
    const cached = readListCache(cacheKey, 300000);

    if (cached) {
      setAllDevelopments(cached);
      setLoading(false);
    }

    async function fetchDevelopments() {
      try {
        if (!cached) setLoading(true);
        setError('');

        const data = await getAllPaginated('/properties', { listing_kind: 'development', nocache: '1' }, 500);
        if (!mounted) return;

        setAllDevelopments(data);
        writeListCache(cacheKey, data);
      } catch {
        if (!mounted) return;
        if (!cached) {
          setAllDevelopments([]);
          setError('No pudimos cargar desarrollos en este momento. Revisa la URL del API en producción.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchDevelopments();
    return () => { mounted = false; };
  }, []);

  const baseSubset = useMemo(() =>
    operacion ? allDevelopments.filter(d => normalize(d.operation_type) === operacion) : allDevelopments,
  [allDevelopments, operacion]);

  const operacionesDisponibles = useMemo(() => {
    const seen = new Set();
    for (const d of allDevelopments) {
      if (d.operation_type) seen.add(normalize(d.operation_type));
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, 'es'));
  }, [allDevelopments]);

  const availableTypes = useMemo(() => {
    const seen = new Map();
    for (const d of baseSubset) {
      if (d.property_type) {
        const key = normalize(d.property_type);
        if (!seen.has(key)) seen.set(key, d.property_type.trim());
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseSubset]);

  const availableZonas = useMemo(() => {
    const seen = new Set();
    for (const d of baseSubset) {
      const state = stateFrom(d.location_full);
      if (state) seen.add(state);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseSubset]);

  const availableColonias = useMemo(() => {
    const seen = new Set();
    const base = zonaFilter ? baseSubset.filter(d => normalize(stateFrom(d.location_full)) === normalize(zonaFilter)) : baseSubset;
    for (const d of base) {
      const col = coloniaFrom(d.location_full);
      if (col) seen.add(col);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseSubset, zonaFilter]);

  const developments = useMemo(() => {
    let result = baseSubset;
    if (typeFilter)    result = result.filter(d => normalize(d.property_type) === normalize(typeFilter));
    if (zonaFilter)    result = result.filter(d => normalize(stateFrom(d.location_full)) === normalize(zonaFilter));
    if (coloniaFilter) result = result.filter(d => normalize(coloniaFrom(d.location_full)) === normalize(coloniaFilter));
    return result;
  }, [baseSubset, typeFilter, zonaFilter, coloniaFilter]);

  const resetDependentFilters = () => { setZonaFilter(''); setColoniaFilter(''); setTypeFilter(''); };
  const anyFilterActive = operacion || typeFilter || zonaFilter || coloniaFilter;

  return (
    <section className="section-shell py-8">
      <div className="mx-auto mb-5 max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-black text-brand-500">Desarrollos</h2>
        <p className="mt-1 text-sm text-gray-500">
          Comercializamos desarrollos de múltiples unidades para vivir o invertir, con acompañamiento completo desde la preventa hasta la entrega.
        </p>
      </div>

      {/* ── Filtros ── */}
      {!loading && !error && (
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-3 rounded-2xl border border-gray-100 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-[0.15em]">Filtros</span>
          </div>

          <div className="h-5 w-px bg-gray-200 hidden sm:block" />

          {/* Operación */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => { setOperacion(null); resetDependentFilters(); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${operacion === null ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Todos
            </button>
            {operacionesDisponibles.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => { setOperacion(op); resetDependentFilters(); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${operacion === op ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {OPERATION_LABELS[op] || (op.charAt(0).toUpperCase() + op.slice(1))}
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

          {/* Estado */}
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
          {anyFilterActive && (
            <button
              type="button"
              onClick={() => { setOperacion(null); resetDependentFilters(); }}
              className="text-xs text-granite underline hover:text-brand-500 transition"
            >
              Limpiar filtros
            </button>
          )}

          <span className="ml-auto text-sm text-slate-400">
            {developments.length} resultado{developments.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">
          Cargando desarrollos...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
          {error}
        </div>
      ) : developments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
          {allDevelopments.length === 0
            ? 'Aún no hay desarrollos sincronizados. Cuando ejecutes la sincronización de Tokko, aparecerán aquí automáticamente.'
            : 'No hay desarrollos que coincidan con los filtros seleccionados.'}
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          {developments.map((development) => (
            <DevelopmentCard key={development.id} development={development} />
          ))}
        </div>
      )}

      <div className="mt-12 rounded-2xl bg-slate-950 px-6 py-10 text-center text-white">
        <h3 className="font-heading text-2xl font-black text-white">¿Buscas un desarrollo puntual?</h3>
        <p className="mx-auto mt-3 max-w-2xl text-white/90">
          Te ayudamos a comparar opciones por etapa, ticket de inversión, rentabilidad estimada y perfil de riesgo.
        </p>
        <a
          href="https://wa.me/524427070872?text=%C2%A1Hola!%20Quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20desarrollos%20inmobiliarios."
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block rounded-xl bg-brand-500 px-8 py-3 font-bold text-white transition hover:bg-brand-700"
        >
          Hablar con un asesor
        </a>
      </div>
    </section>
  );
}
