import { useEffect, useState } from 'react';
import api from '../services/api';
import PropertyCard from '../components/PropertyCard';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [filter, setFilter] = useState(null);

  useEffect(() => {
    async function fetchProperties() {
      const params = filter ? `?operation_type=${filter}&limit=30&page=1` : '?limit=30&page=1';
      const response = await api.get(`/properties${params}`);
      setProperties(response.data.data);
    }

    fetchProperties();
  }, [filter]);

  return (
    <section className="section-shell py-14">
      <div className="mb-10 text-center">
        <h2 className="font-heading text-4xl font-black text-slate-950">Propiedades</h2>
        <p className="mt-2 text-gray-600">Catálogo completo de propiedades en venta y renta con información verificada.</p>
      </div>

      <div className="mb-8 flex justify-center gap-3">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-6 py-2 font-semibold transition ${
            filter === null ? 'bg-brand-500 text-white' : 'border border-brand-500 text-brand-500 hover:bg-brand-50'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter('venta')}
          className={`rounded-full px-6 py-2 font-semibold transition ${
            filter === 'venta' ? 'bg-orange-500 text-white' : 'border border-orange-500 text-orange-500 hover:bg-orange-50'
          }`}
        >
          En Venta
        </button>
        <button
          onClick={() => setFilter('renta')}
          className={`rounded-full px-6 py-2 font-semibold transition ${
            filter === 'renta' ? 'bg-green-500 text-white' : 'border border-green-500 text-green-500 hover:bg-green-50'
          }`}
        >
          En Renta
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  );
}
