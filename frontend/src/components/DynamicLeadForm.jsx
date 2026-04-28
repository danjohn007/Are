import { useState } from 'react';
import api from '../services/api';
import { Send, Loader2 } from 'lucide-react';

export default function DynamicLeadForm({ service, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(() => {
    const left = Math.floor(Math.random() * 9) + 1;
    const right = Math.floor(Math.random() * 9) + 1;
    return { left, right, answer: '' };
  });

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function refreshCaptcha() {
    const left = Math.floor(Math.random() * 9) + 1;
    const right = Math.floor(Math.random() * 9) + 1;
    setCaptcha({ left, right, answer: '' });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (Number(captcha.answer) !== captcha.left + captcha.right) {
      alert('Verificacion incorrecta. Resuelve el captcha para continuar.');
      refreshCaptcha();
      return;
    }

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
      refreshCaptcha();
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

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-slate-700">Verificacion anti-bot</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-700" htmlFor="lead-captcha">
            ¿Cuanto es {captcha.left} + {captcha.right}?
          </label>
          <input
            id="lead-captcha"
            className="w-24 rounded-lg border p-2 text-center"
            inputMode="numeric"
            value={captcha.answer}
            onChange={(e) => setCaptcha((prev) => ({ ...prev, answer: e.target.value }))}
            required
          />
          <button
            type="button"
            onClick={refreshCaptcha}
            className="rounded-lg border border-brand-500 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            Cambiar
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-500 px-4 py-3 font-bold text-white disabled:opacity-60 hover:bg-brand-600"
      >
        {loading
          ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Enviando...</span>
          : <span className="flex items-center justify-center gap-2"><Send size={16} /> Enviar solicitud</span>
        }
      </button>
    </form>
  );
}
