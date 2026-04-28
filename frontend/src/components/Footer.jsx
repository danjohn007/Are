import { Link } from 'react-router-dom';

export default function Footer() {
  const logoSrc = `${import.meta.env.BASE_URL}color_are.png`;
  const socialLinks = [
    { href: 'https://www.instagram.com/arerealestatemx/', label: 'Instagram' },
    { href: 'https://www.facebook.com/alterrarealestate', label: 'Facebook' },
    { href: 'https://www.linkedin.com/company/alterrarealestate', label: 'LinkedIn' },
    { href: 'https://www.youtube.com/@arealterrarealestate7119', label: 'YouTube' },
  ];
  const footerLinks = [
    { to: '/', label: 'Inicio' },
    { to: '/properties', label: 'Propiedades' },
    { to: '/developments', label: 'Desarrollos' },
    { to: '/services', label: 'Servicios' },
    { to: '/blog', label: 'BLOG' },
    { to: '/contact', label: 'Contacto' },
  ];

  return (
    <footer className="mt-12 border-t border-gray-200 bg-white/90 text-slate-600 backdrop-blur-sm">
      <div className="section-shell grid gap-10 py-14 md:grid-cols-4">
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center">
            <img
              src={logoSrc}
              alt="ARE"
              className="h-20 w-auto object-contain md:h-24"
            />
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            Especialistas en bienes raíces con más de 25 años conectando personas con los mejores inmuebles.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h4 className="mb-4 font-subheading text-sm uppercase tracking-[0.2em] text-slate-950">Navegacion</h4>
          <ul className="space-y-2 text-sm">
            {footerLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="transition hover:text-brand-500">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="mb-4 font-subheading text-sm uppercase tracking-[0.2em] text-slate-950">Contacto</h4>
          <ul className="space-y-2 text-sm">
            <li>info@are.mx</li>
            <li>442 707 0872</li>
            <li>Lunes–Viernes: 9am – 7pm</li>
          </ul>
          <ul className="mt-4 space-y-2 text-sm">
            {socialLinks.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-brand-500"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Office */}
        <div>
          <h4 className="mb-4 font-subheading text-sm uppercase tracking-[0.2em] text-slate-950">Oficinas</h4>
          <p className="text-sm leading-relaxed">
            Prol. Bernardo Quintana No. 300 Piso 14-A Torre 57 CP 76090<br />
            Centro Sur, Queretaro, Qro
          </p>
          <a
            href="https://maps.app.goo.gl/u5hinV12sCAoSfmB9"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-brand-700 transition hover:text-brand-500"
          >
            Ver en Google Maps
          </a>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-isabelline/70">
        <div className="section-shell flex flex-col items-center justify-between gap-3 py-5 text-xs md:flex-row">
          <span>© {new Date().getFullYear()} ARE — Todos los derechos reservados.</span>
          <span>Diseñado para profesionales del sector inmobiliario</span>
        </div>
      </div>
    </footer>
  );
}

