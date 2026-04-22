import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  function update(name, value) {
    setCredentials((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(credentials.email, credentials.password);
      navigate('/admin');
    } catch (_error) {
      alert('Acceso denegado. Por favor verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section-shell py-14">
      <div className="mx-auto max-w-md rounded-2xl border border-orange-100 bg-white p-8 shadow-sm">
        <h2 className="font-heading text-3xl font-black text-slate-950">Acceso Administrador</h2>
        <p className="mt-2 text-sm text-gray-600">Ingresa tus credenciales para acceder al panel de control.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input className="w-full rounded-lg border p-3" type="email" value={credentials.email} onChange={(e) => update('email', e.target.value)} placeholder="Correo electrónico" required />
          <input className="w-full rounded-lg border p-3" type="password" value={credentials.password} onChange={(e) => update('password', e.target.value)} placeholder="Contraseña" required />
          <button className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white hover:bg-brand-600" type="submit" disabled={loading}>
            {loading ? '⏳ Iniciando sesión...' : '🔓 Iniciar sesión'}
          </button>
        </form>
      </div>
    </section>
  );
}
