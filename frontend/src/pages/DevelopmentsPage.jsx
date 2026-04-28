import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllPaginated } from '../services/api';
import PropertyCard from '../components/PropertyCard';

export default function DevelopmentsPage() {
  const [developments, setDevelopments] = useState([]);

  useEffect(() => {
    async function fetchDevelopments() {
      const data = await getAllPaginated('/properties', {
        listing_kind: 'development'
      });
      setDevelopments(data);
    }

    fetchDevelopments();
  }, []);

  return (
    <section className="section-shell py-14">
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <h2 className="font-heading text-4xl font-black text-slate-950">Desarrollos</h2>
        <p className="mt-2 text-gray-600">
          Comercializamos desarrollos de multiples unidades para vivir o invertir, con acompanamiento completo desde la preventa hasta la entrega.
        </p>
      </div>

      {developments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
          Aun no hay desarrollos sincronizados. Cuando ejecutes la sincronizacion de Tokko, apareceran aqui automaticamente.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {developments.map((development) => (
            <PropertyCard key={development.id} property={development} />
          ))}
        </div>
      )}

      <div className="mt-12 rounded-2xl bg-slate-950 px-6 py-10 text-center text-white">
        <h3 className="font-heading text-2xl font-black text-white">¿Buscas un desarrollo puntual?</h3>
        <p className="mx-auto mt-3 max-w-2xl text-gray-300">
          Te ayudamos a comparar opciones por etapa, ticket de inversion, rentabilidad estimada y perfil de riesgo.
        </p>
        <Link
          to="/contact"
          className="mt-6 inline-block rounded-xl bg-brand-500 px-8 py-3 font-bold text-white transition hover:bg-brand-700"
        >
          Hablar con un asesor
        </Link>
      </div>
    </section>
  );
}
