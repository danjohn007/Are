import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, Mail, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  function update(name, value) {
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(credentials.email, credentials.password);
      navigate('/admin', { replace: true });
    } catch (_error) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-brand-900 px-4 py-12">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl flex">

        {/* Left panel — brand */}
        <div
          className="hidden md:flex md:w-1/2 flex-col justify-between p-10 text-white relative"
          style={{
            background: 'linear-gradient(145deg, #BC561D 0%, #843c14 55%, #2d1508 100%)',
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-20 -right-10 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative z-10">
            <span className="inline-block rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white/90">
              Panel Administrativo
            </span>
            <h1 className="mt-8 font-heading text-4xl font-black leading-tight text-white">
              are <span className="text-brand-500">REAL ESTATE</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/80 max-w-xs">
              Accede al centro de control para gestionar propiedades, publicaciones, leads y métricas de tu negocio.
            </p>
          </div>

          <div className="relative z-10 space-y-3">
            {['Gestión de propiedades', 'Publicaciones de blog', 'Sincronización con Tokko'].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-300 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 bg-white px-8 py-12 md:px-12 flex flex-col justify-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 mb-5">
              <Lock size={22} className="text-brand-500" />
            </div>
            <h2 className="font-heading text-3xl font-black text-slate-950">Iniciar sesión</h2>
            <p className="mt-1.5 text-sm text-slate-500">Ingresa tus credenciales para continuar.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  type="email"
                  value={credentials.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="admin@areinmobiliaria.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              <LogIn size={18} />
              {loading ? 'Verificando...' : 'Ingresar al panel'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} are REAL ESTATE · Acceso restringido
          </p>
        </div>

      </div>
    </div>
  );
}

