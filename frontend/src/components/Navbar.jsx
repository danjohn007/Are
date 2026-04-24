import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/properties', label: 'Propiedades' },
  { to: '/developments', label: 'Desarrollos' },
  { to: '/services', label: 'Servicios' },
  { to: '/blog', label: 'BLOG' },
  { to: '/contact', label: 'Contacto' },
];

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const logoSrc = `${import.meta.env.BASE_URL}color_are.png`;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm">
      {/* Top bar */}
      <div className="hidden border-b border-gray-200 surface-dark md:block">
        <div className="section-shell flex items-center justify-between py-1.5 text-xs text-gray-300">
          <span>Bienvenido a ARE — Especialistas en Bienes Raíces</span>
          <span>info@are.mx</span>
        </div>
      </div>

      {/* Main navbar */}
      <div className="section-shell flex items-center justify-between py-3">
        {/* Logo */}
        <Link to="/" className="shrink-0">
          <img
            src={logoSrc}
            alt="ARE"
            className="h-16 w-auto object-contain md:h-20"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden gap-8 md:flex">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `font-subheading text-sm uppercase tracking-[0.16em] transition ${
                  isActive ? 'text-brand-500' : 'text-slate-700 hover:text-brand-500'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <Link
              to="/admin"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition hover:bg-brand-700"
            >
              Panel Admin
            </Link>
          )}
          <Link
            to="/contact"
            className="hidden rounded-lg border border-brand-500 px-4 py-2 text-sm text-brand-700 transition hover:bg-brand-50 md:block"
          >
            Cotizar
          </Link>

          {/* Mobile hamburger */}
          <button
            className="ml-2 flex flex-col gap-1.5 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            <span className={`h-0.5 w-6 bg-slate-800 transition-transform ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`h-0.5 w-6 bg-slate-800 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`h-0.5 w-6 bg-slate-800 transition-transform ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 md:hidden">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `font-subheading block py-3 text-sm uppercase tracking-[0.16em] ${
                  isActive ? 'text-brand-500' : 'text-slate-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
