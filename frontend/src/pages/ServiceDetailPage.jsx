import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, MessageCircle } from 'lucide-react';
import api from '../services/api';

const GRADIENTS = [
  'from-brand-500 to-orange-600',
  'from-slate-700 to-slate-900',
  'from-emerald-500 to-teal-700',
  'from-violet-500 to-purple-700',
  'from-sky-500 to-blue-700',
  'from-rose-500 to-pink-700',
];
function pickGradient(id) {
  return GRADIENTS[((id || 1) - 1) % GRADIENTS.length];
}

export default function ServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchService() {
      try {
        const res = await api.get(`/services/${id}`);
        setService(res.data.data);
      } catch {
        setService(null);
      } finally {
        setLoading(false);
      }
    }
    fetchService();
  }, [id]);

  if (loading) {
    return (
      <section className="section-shell py-14 text-center text-gray-500">
        Cargando servicio...
      </section>
    );
  }

  if (!service) {
    return (
      <section className="section-shell py-14 text-center">
        <p className="text-gray-600 mb-4">El servicio no fue encontrado.</p>
        <Link to="/services" className="text-brand-600 font-semibold hover:underline">
          ← Volver a servicios
        </Link>
      </section>
    );
  }

  const gradient = pickGradient(service.id);
  const initials = (service.name || '').slice(0, 2).toUpperCase();

  function goToContact() {
    const params = new URLSearchParams({
      service_id: service.id,
      service_name: service.name,
    });
    navigate(`/contact?${params.toString()}`);
  }

  return (
    <section className="section-shell py-10">
      {/* Breadcrumb */}
      <Link
        to="/services"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-800 transition"
      >
        <ArrowLeft size={16} /> Volver a servicios
      </Link>

      {/* ── Hero imagen ── */}
      <div
        data-aos="fade-up"
        className={`relative mb-6 h-56 w-full overflow-hidden rounded-3xl shadow-lg sm:h-72 md:h-96 lg:h-[420px] ${service.image_url ? '' : `bg-gradient-to-br ${gradient}`}`}
      >
        {service.image_url ? (
          <img
            src={service.image_url}
            alt={service.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="select-none text-9xl font-black text-white/20">{initials}</span>
          </div>
        )}
        {/* Overlay con precio */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
              Servicio inmobiliario
            </span>
            <h1 className="font-heading text-3xl font-black text-white drop-shadow-lg md:text-4xl">
              {service.name}
            </h1>
          </div>

        </div>
      </div>

      {/* ── Botón CTA visible en móvil (arriba del contenido) ── */}
      <button
        type="button"
        onClick={goToContact}
        className="mb-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-brand-700 active:scale-95 lg:hidden"
      >
        <MessageCircle size={20} />
        Quiero más información
      </button>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* ── Info ── */}
        <div data-aos="fade-right">
          {/* Descripción */}
          {service.description && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="font-heading text-lg font-bold text-slate-800 mb-3">Descripción</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{service.description}</p>
            </div>
          )}

          {/* Beneficios */}
          <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-6">
            <h2 className="font-heading text-lg font-bold text-brand-700 mb-4">¿Por qué elegirnos?</h2>
            <ul className="space-y-3">
              {[
                'Asesoría personalizada desde el primer contacto',
                'Respuesta en menos de 24 horas',
                'Equipo especializado con experiencia comprobada',
                'Acompañamiento completo durante todo el proceso',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-brand-900">
                  <CheckCircle size={17} className="mt-0.5 shrink-0 text-brand-500" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── CTA Card ── */}
        <div data-aos="fade-left">
          <div className="sticky top-24 rounded-3xl border border-gray-100 bg-white p-8 shadow-md">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-2">¿Te interesa?</p>
            <h3 className="font-heading text-2xl font-black text-slate-950 leading-snug">
              {service.name}
            </h3>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              Un asesor especializado te contactará a la brevedad para orientarte con toda la información que necesitas.
            </p>

            <div className="mt-6 rounded-2xl bg-brand-50 border border-brand-100 p-4 text-sm text-brand-800">
              <p className="font-semibold mb-1">¿Qué pasa al hacer clic?</p>
              <ul className="space-y-1 text-brand-700 text-xs">
                <li>✓ Se llena el formulario con este servicio preseleccionado</li>
                <li>✓ Tu solicitud llega directo a nuestro equipo</li>
                <li>✓ Te contactamos en menos de 24 horas</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={goToContact}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-brand-700 active:scale-95"
            >
              <MessageCircle size={20} />
              Quiero más información
            </button>

            <p className="mt-3 text-center text-xs text-gray-400">
              Sin compromisos. Respondemos todas las consultas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
