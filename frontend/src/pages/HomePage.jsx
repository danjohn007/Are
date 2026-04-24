import { Link } from 'react-router-dom';

const stats = [
  { value: '500+', label: 'Propiedades activas' },
  { value: '12+', label: 'Años de experiencia' },
  { value: '1,200+', label: 'Clientes satisfechos' },
  { value: '98%', label: 'Tasa de cierre' },
];

const features = [
  {
    icon: '🏠',
    title: 'Venta y Renta',
    desc: 'Catálogo actualizado de propiedades residenciales y comerciales en las mejores zonas.',
  },
  {
    icon: '📋',
    title: 'Asesoría Personalizada',
    desc: 'Nuestros asesores te guían en cada paso del proceso de compra, venta o renta.',
  },
  {
    icon: '📊',
    title: 'Valuación de Inmuebles',
    desc: 'Estimamos el valor real de tu propiedad con estudios de mercado actualizados.',
  },
  {
    icon: '⚡',
    title: 'Gestión Rápida',
    desc: 'Procesos ágiles, contratos claros y seguimiento puntual para cerrar en el menor tiempo.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="surface-dark relative overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1600')" }}
        />
        <div className="relative section-shell py-28 md:py-36">
          <div className="max-w-2xl" data-aos="fade-up">
            <span className="font-subheading mb-4 inline-block rounded-full border border-brand-500 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-brand-100">
              Bienes Raíces — México
            </span>
            <h1 className="font-heading text-4xl font-black leading-tight md:text-6xl">
              Tu próxima propiedad<br />
              <span className="text-brand-500">comienza aquí.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-300">
              Conectamos personas con espacios que transforman su vida. Compra, vende o renta con la asesoría de los mejores especialistas.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/properties"
                className="rounded-xl bg-brand-500 px-8 py-4 font-bold text-white shadow-lg transition hover:bg-brand-700"
              >
                Ver propiedades
              </Link>
              <Link
                to="/contact"
                className="rounded-xl border border-white/30 px-8 py-4 font-bold text-white transition hover:border-brand-500 hover:text-brand-500"
              >
                Hablar con un asesor
              </Link>
            </div>
          </div>
        </div>

        {/* Diagonal cut */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-isabelline" style={{ clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }} />
      </section>

      {/* Stats bar */}
      <section className="bg-white/90 py-10 shadow-sm backdrop-blur-sm">
        <div className="section-shell grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center" data-aos="fade-up">
              <p className="font-heading text-3xl font-black text-brand-500 md:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="section-shell">
          <div className="mb-12 text-center" data-aos="fade-up">
            <span className="font-subheading text-xs uppercase tracking-[0.22em] text-brand-500">¿Por qué elegirnos?</span>
            <h2 className="mt-2 font-heading text-3xl font-black text-slate-950 md:text-4xl">
              Servicio inmobiliario completo
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-500">
              Desde la búsqueda hasta la firma, te acompañamos con profesionalismo y transparencia.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                data-aos="fade-up"
                className="surface-panel group rounded-2xl p-8 transition hover:border-brand-500 hover:shadow-md"
              >
                <span className="text-4xl">{f.icon}</span>
                <h3 className="mt-4 font-heading text-lg font-bold text-slate-950">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured properties CTA */}
      <section className="bg-isabelline py-20">
        <div className="section-shell grid items-center gap-10 lg:grid-cols-2">
          <div data-aos="fade-right">
            <span className="font-subheading text-xs uppercase tracking-[0.22em] text-brand-500">Propiedades destacadas</span>
            <h2 className="mt-2 font-heading text-3xl font-black text-slate-950 md:text-4xl">
              Encuentra el espacio ideal para ti
            </h2>
            <p className="mt-4 text-gray-600">
              Explora nuestro catálogo con las mejores opciones en ubicaciones estratégicas, precios competitivos y todo el respaldo de ARE.
            </p>
            <Link
              to="/properties"
              className="mt-8 inline-block rounded-xl bg-brand-500 px-8 py-4 font-bold text-white transition hover:bg-brand-700"
            >
              Explorar catálogo
            </Link>
          </div>
          <div data-aos="fade-left" className="overflow-hidden rounded-3xl shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900"
              alt="Propiedad destacada"
              className="h-72 w-full object-cover transition duration-500 hover:scale-105"
            />
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section
        className="py-20 text-isabelline"
        style={{
          background: 'linear-gradient(135deg, #434242 0%, #606060 100%)',
          borderTop: '1px solid rgba(188, 86, 29, 0.45)',
          borderBottom: '1px solid rgba(188, 86, 29, 0.45)'
        }}
      >
        <div className="section-shell text-center" data-aos="fade-up">
          <h2 className="font-heading text-3xl font-black text-isabelline md:text-4xl">
            ¿Listo para dar el siguiente paso?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-gray-100">
            Contáctanos hoy y un asesor especializado te atenderá sin compromiso.
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-block rounded-xl bg-brand-500 px-10 py-4 font-bold text-isabelline transition hover:bg-brand-700"
          >
            Contactar ahora
          </Link>
        </div>
      </section>
    </>
  );
}

