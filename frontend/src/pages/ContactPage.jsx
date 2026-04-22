import { useState } from 'react';
import api from '../services/api';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);

  function setValue(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      await api.post('/leads', {
        ...form,
        source: 'contact-page'
      });
      setForm({ name: '', email: '', phone: '', message: '' });
      alert('Tu mensaje ha sido enviado exitosamente. Nos pondremos en contacto pronto.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section-shell py-14">
      <div className="mx-auto max-w-2xl rounded-2xl border border-orange-100 bg-white p-8 shadow-sm">
        <h2 className="font-heading text-4xl font-black text-slate-950">Contáctanos</h2>
        <p className="mt-2 text-gray-600">Cuéntanos qué necesitas y te responderemos lo antes posible.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input className="w-full rounded-lg border p-3" placeholder="Nombre completo" value={form.name} onChange={(e) => setValue('name', e.target.value)} required />
          <input className="w-full rounded-lg border p-3" placeholder="Correo electrónico" type="email" value={form.email} onChange={(e) => setValue('email', e.target.value)} required />
          <input className="w-full rounded-lg border p-3" placeholder="Teléfono" value={form.phone} onChange={(e) => setValue('phone', e.target.value)} required />
          <textarea className="w-full rounded-lg border p-3" rows={5} placeholder="Mensaje" value={form.message} onChange={(e) => setValue('message', e.target.value)} />
          <button className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white hover:bg-brand-600" disabled={loading} type="submit">
            {loading ? '⏳ Enviando...' : '📧 Enviar mensaje'}
          </button>
        </form>
      </div>
    </section>
  );
}
