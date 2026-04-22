import { useState } from 'react';
import api from '../services/api';

export default function DynamicLeadForm({ service, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const extra = {};
      (service?.form_schema?.fields || []).forEach((field) => {
        if (form[field.name]) {
          extra[field.name] = form[field.name];
        }
      });

      await api.post('/leads', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
        service_id: service?.id,
        source: 'web',
        extra_data: extra
      });

      setForm({ name: '', email: '', phone: '', message: '' });
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <input className="w-full rounded-lg border p-3" placeholder="Nombre completo" value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
      <input className="w-full rounded-lg border p-3" placeholder="Correo electrónico" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} required />
      <input className="w-full rounded-lg border p-3" placeholder="Teléfono" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} required />
      <textarea className="w-full rounded-lg border p-3" placeholder="Mensaje (opcional)" value={form.message} onChange={(e) => updateField('message', e.target.value)} rows={3} />

      {(service?.form_schema?.fields || []).map((field) => (
        <div key={field.name}>
          <label className="mb-1 block text-sm font-semibold">{field.label}</label>
          {field.type === 'select' ? (
            <select
              className="w-full rounded-lg border p-3"
              value={form[field.name] || ''}
              onChange={(e) => updateField(field.name, e.target.value)}
              required={Boolean(field.required)}
            >
              <option value="">Selecciona una opción</option>
              {(field.options || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="w-full rounded-lg border p-3"
              value={form[field.name] || ''}
              onChange={(e) => updateField(field.name, e.target.value)}
              required={Boolean(field.required)}
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white disabled:opacity-60 hover:bg-brand-600"
      >
        {loading ? '⏳ Enviando...' : '✉️ Enviar solicitud'}
      </button>
    </form>
  );
}
