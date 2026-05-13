import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';
import ServiceCard from '../components/ServiceCard';

const CATEGORIES = [
  {
    key: 'propietarios',
    label: 'Propietarios e Inversionistas',
    description: 'Soluciones especializadas para dueños de inmuebles e inversionistas: valuación, renta, venta y administración de activos.',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  },
  {
    key: 'usuarios',
    label: 'Usuarios',
    description: 'Servicios pensados para quienes buscan comprar, rentar o encontrar su próximo inmueble con asesoría completa.',
    image: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80',
  },
  {
    key: 'are_homes',
    label: 'Are Homes',
    description: 'Descubre la rama de ARE enfocada en vivienda accesible y desarrollos residenciales de alto impacto.',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    external: 'https://arehomes.mx',
  },
];

export default function ServicesPage() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCategory) return;
    async function fetchData() {
      try {
        setLoading(true);
        const response = await api.get(`/services?limit=50&page=1&category=${selectedCategory}`);
        setServices(response.data.data || []);
      } catch {
        setServices([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedCategory]);

  function handleSelect(service) {
    const params = new URLSearchParams({
      service_id: service.id,
      service_name: service.name,
    });
    navigate(`/contact?${params.toString()}`);
  }

  const activeCat = CATEGORIES.find((c) => c.key === selectedCategory);

  /* ── Category landing ── */
  if (!selectedCategory) {
    return (
      <section className="section-shell py-14">
        <div className="mb-12 text-center">
          <h2 className="font-heading text-4xl font-black text-brand-500">Servicios Inmobiliarios</h2>
          <p className="mt-2 text-gray-600">
            Servicios profesionales especializados con acompañamiento completo y respuesta inmediata.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const isExternal = Boolean(cat.external);
            const cardContent = (
              <div className="group relative flex h-72 cursor-pointer flex-col justify-end overflow-hidden rounded-3xl shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-2xl sm:h-80">
                {/* Background image */}
                <img
                  src={cat.image}
                  alt={cat.label}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                {/* Content */}
                <div className="relative z-10 p-6">
                  {isExternal && (
                    <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                      Sitio externo
                    </span>
                  )}
                  <h3 className="font-heading text-2xl font-black leading-tight text-white drop-shadow">
                    {cat.label}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-white/80 leading-relaxed">
                    {cat.description}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow transition group-hover:bg-brand-600">
                    {isExternal ? 'Visitar sitio →' : 'Ver servicios →'}
                  </div>
                </div>
              </div>
            );

            return isExternal ? (
              <a
                key={cat.key}
                href={cat.external}
                target="_blank"
                rel="noreferrer"
                data-aos="fade-up"
              >
                {cardContent}
              </a>
            ) : (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                data-aos="fade-up"
                className="text-left"
              >
                {cardContent}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  /* ── Services list ── */
  return (
    <section className="section-shell py-14">
      <button
        type="button"
        onClick={() => { setSelectedCategory(null); setServices([]); }}
        className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-800 transition"
      >
        <ArrowLeft size={16} /> Categorías de servicios
      </button>

      <div className="mb-10 text-center">
        <h2 className="font-heading text-4xl font-black text-brand-500">{activeCat?.label}</h2>
        <p className="mt-2 text-gray-600">{activeCat?.description}</p>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 animate-pulse rounded-3xl bg-gray-100" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          No hay servicios disponibles en esta categoría.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
