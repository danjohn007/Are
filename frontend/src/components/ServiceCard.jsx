export default function ServiceCard({ service, onSelect }) {
  return (
    <article data-aos="fade-up" className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <h3 className="font-heading text-xl font-bold text-brand-700">{service.name}</h3>
      <p className="mt-2 text-sm text-gray-600">{service.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-black text-gray-900">${Number(service.price || 0).toLocaleString('es-MX')} MXN</span>
        <button
          type="button"
          onClick={() => onSelect(service)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Solicitar información
        </button>
      </div>
    </article>
  );
}
