export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-slate-950 text-gray-400">
      <div className="section-shell grid gap-10 py-14 md:grid-cols-4">
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-heading text-sm font-black text-white">A</span>
            <span className="font-heading text-xl font-extrabold tracking-tight text-white">
              ARE<span className="text-brand-500">.</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            Especialistas en bienes raíces con más de 12 años conectando personas con los mejores inmuebles.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h4 className="mb-4 font-heading text-sm font-bold uppercase tracking-widest text-white">Navegación</h4>
          <ul className="space-y-2 text-sm">
            {['Inicio', 'Propiedades', 'Servicios', 'Noticias', 'Contacto'].map((item) => (
              <li key={item}>
                <a href="#" className="transition hover:text-brand-500">{item}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="mb-4 font-heading text-sm font-bold uppercase tracking-widest text-white">Contacto</h4>
          <ul className="space-y-2 text-sm">
            <li>contacto@are.mx</li>
            <li>+52 55 5555 4444</li>
            <li>Lunes–Viernes: 9am – 7pm</li>
          </ul>
        </div>

        {/* Office */}
        <div>
          <h4 className="mb-4 font-heading text-sm font-bold uppercase tracking-widest text-white">Oficinas</h4>
          <p className="text-sm leading-relaxed">
            Av. Insurgentes Sur 1602<br />
            Col. Crédito Constructor<br />
            Ciudad de México, CDMX
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="section-shell flex flex-col items-center justify-between gap-3 py-5 text-xs md:flex-row">
          <span>© {new Date().getFullYear()} ARE — Todos los derechos reservados.</span>
          <span>Diseñado para profesionales del sector inmobiliario</span>
        </div>
      </div>
    </footer>
  );
}

