import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ServiceCard from '../components/ServiceCard';

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await api.get('/services?limit=30&page=1');
        setServices(response.data.data || []);
      } catch {
        setServices([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function handleSelect(service) {
    const params = new URLSearchParams({
      service_id: service.id,
      service_name: service.name,
    });
    navigate(`/contact?${params.toString()}`);
  }

  return (
    <section className="section-shell py-14">
      <div className="mb-12 text-center">
        <h2 className="font-heading text-4xl font-black text-brand-500">Servicios Inmobiliarios</h2>
        <p className="mt-2 text-gray-600">
          Servicios profesionales especializados con acompañamiento completo y respuesta inmediata.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 animate-pulse rounded-3xl bg-gray-100" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          No hay servicios disponibles en este momento.
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
