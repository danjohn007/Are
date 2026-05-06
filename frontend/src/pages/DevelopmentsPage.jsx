import { useEffect, useMemo, useState } from 'react';
import { getAllPaginated } from '../services/api';
import DevelopmentCard from '../components/DevelopmentCard';

function normalizeCity(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function capitalizeCity(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function DevelopmentsPage() {
  const [allDevelopments, setAllDevelopments] = useState([]);
  const [operacion, setOperacion] = useState(null);
  const [ciudad, setCiudad] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDevelopments() {
      try {
        setLoading(true);
        setError('');
        const data = await getAllPaginated('/properties', {
          listing_kind: 'development'
        });
        setAllDevelopments(data);
      } catch (_error) {
        setAllDevelopments([]);
        setError('No pudimos cargar desarrollos en este momento. Revisa la URL del API en producción.');
      } finally {
        setLoading(false);
      }
    }

    fetchDevelopments();
  }, []);

  // Mapa de valores de Tokko → etiquetas en español
  const OPERATION_LABELS = {
    venta: 'En Venta',
    renta: 'En Renta',
    alquiler: 'En Renta',
    'alquiler temporario': 'Alquiler temporal',
    venta_y_alquiler: 'Venta y Alquiler',
  };

  // Tipos de operación presentes en los datos actuales
  const operacionesDisponibles = useMemo(() => {
    const seen = new Set();
    for (const d of allDevelopments) {
      if (d.operation_type) seen.add(d.operation_type.toLowerCase().trim());
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, 'es'));
  }, [allDevelopments]);

  // Ciudades disponibles según operación seleccionada
  const ciudadesDisponibles = useMemo(() => {
    const seen = new Map();
    const base = operacion
      ? allDevelopments.filter((d) => (d.operation_type || '').toLowerCase().trim() === operacion)
      : allDevelopments;
    for (const d of base) {
      if (d.city) {
        const key = normalizeCity(d.city);
        if (!seen.has(key)) seen.set(key, capitalizeCity(d.city.trim()));
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [allDevelopments, operacion]);

  const developments = useMemo(() => {
    let result = allDevelopments;
    if (operacion) result = result.filter((d) => (d.operation_type || '').toLowerCase().trim() === operacion);
    if (ciudad) result = result.filter((d) => normalizeCity(d.city) === normalizeCity(ciudad));
    return result;
  }, [allDevelopments, operacion, ciudad]);

  return (
    <section className="section-shell py-14">
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <h2 className="font-heading text-4xl font-black text-brand-500">Desarrollos</h2>
        <p className="mt-2 text-gray-600">
          Comercializamos desarrollos de múltiples unidades para vivir o invertir, con acompañamiento completo desde la preventa hasta la entrega.
        </p>
      </div>

      {/* ── Filtros ── */}
      {!loading && !error && (
        <div className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-gray-100 bg-white px-6 py-4 shadow-sm">
          {/* Icono + etiqueta */}
          <div className="flex items-center gap-2 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-[0.15em]">Filtros</span>
          </div>

          <div className="h-5 w-px bg-gray-200 hidden sm:block" />

          {/* Tipo de operación */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => { setOperacion(null); setCiudad(''); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                operacion === null ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos
            </button>
            {operacionesDisponibles.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => { setOperacion(op); setCiudad(''); }}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                  operacion === op ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {OPERATION_LABELS[op] || (op.charAt(0).toUpperCase() + op.slice(1))}
              </button>
            ))}
          </div>

          {ciudadesDisponibles.length > 0 && (
            <>
              <div className="h-5 w-px bg-gray-200 hidden sm:block" />

              {/* Filtro por ciudad */}
              <div className="relative">
                <select
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  className="appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-4 pr-9 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 cursor-pointer"
                >
                  <option value="">Todas las ciudades</option>
                  {ciudadesDisponibles.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </>
          )}

          {/* Contador de resultados */}
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
