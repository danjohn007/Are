import { Link } from 'react-router-dom';

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

export default function ServiceCard({ service, onSelect }) {
  const gradient = pickGradient(service.id);
  const initials = (service.name || '').slice(0, 2).toUpperCase();

  return (
    <article
      data-aos="fade-up"
      className="group flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Imagen o gradiente — clic abre el detalle */}
      <Link to={`/services/${service.id}`} className="block">
        <div className={`relative h-48 overflow-hidden ${service.image_url ? '' : `bg-gradient-to-br ${gradient}`}`}>
          {service.image_url ? (
            <img
              src={service.image_url}
              alt={service.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="select-none text-6xl font-black text-white/20">{initials}</span>
            </div>
          )}
          {/* overlay sutil */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
            Servicio
          </span>

        </div>
      </Link>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-xl font-black leading-snug text-slate-950">{service.name}</h3>
        {service.description && (
          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-gray-500">
            {service.description}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => onSelect(service)}
            className="rounded-xl border border-brand-400 px-4 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
          >
            Solicitar
          </button>
          <Link
            to={`/services/${service.id}`}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Ver detalle
          </Link>
        </div>
      </div>
    </article>
  );
}
