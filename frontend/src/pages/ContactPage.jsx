import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const propertyId    = searchParams.get('property_id') ? Number(searchParams.get('property_id')) : null;
  const propertyTitle = searchParams.get('property_title') || null;
  const serviceId     = searchParams.get('service_id') ? Number(searchParams.get('service_id')) : null;
  const serviceName   = searchParams.get('service_name') || null;
  const brochureUrl   = searchParams.get('brochure_url') || null;

  const [form, setForm] = useState(() => ({
    name: '',
    email: '',
    phone: '',
    message: brochureUrl && serviceName
      ? `Solicito el brochure del servicio: ${serviceName}\n\n`
      : serviceName
        ? `Necesito información sobre el servicio: ${serviceName}\n\n`
        : propertyTitle
          ? `Necesito información sobre la propiedad: ${propertyTitle}\n\n`
          : ``,
  }));
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [captcha, setCaptcha] = useState(() => {
    const left = Math.floor(Math.random() * 9) + 1;
    const right = Math.floor(Math.random() * 9) + 1;
    return { left, right, answer: '' };
  });

  function setValue(name, value) {
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
      alert('Verificación incorrecta. Resuelve el captcha para continuar.');
      refreshCaptcha();
      return;
    }

    setLoading(true);

    try {
      await api.post('/leads', {
        ...form,
        message: form.message,
        source: 'contact-page',
        ...(propertyId ? { property_id: propertyId } : {}),
        ...(serviceId  ? { service_id: serviceId }   : {}),
      });
      setForm({ name: '', email: '', phone: '', message: '' });
      refreshCaptcha();
      if (brochureUrl) {
        alert('Tu mensaje ha sido enviado. El brochure se descargará en un momento.');
        const a = document.createElement('a');
        a.href = brochureUrl;
        a.target = '_blank';
        a.rel = 'noreferrer';
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert('Tu mensaje ha sido enviado exitosamente. Nos pondremos en contacto pronto.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section-shell py-14 md:py-16">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative order-last overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-orange-900 px-7 py-8 text-white shadow-xl md:px-9 md:py-10 lg:order-first">
          <div className="pointer-events-none absolute -right-10 -top-8 h-36 w-36 rounded-full bg-orange-400/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">Contacto ARE</p>
          <h2 className="mt-4 font-heading text-4xl font-black leading-tight text-white md:text-5xl">Hablemos de tu próxima decisión inmobiliaria</h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/85 md:text-base">
            Cuéntanos qué buscas y te ayudamos a aterrizar opciones, zonas y estrategia con una asesoría clara y personalizada.
          </p>

          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-semibold text-white">Respuesta más precisa</p>
              <p className="mt-1 text-sm text-white/75">Mientras más contexto nos compartas, mejor podremos orientarte desde el primer contacto.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-semibold text-white">Atención comercial</p>
              <p className="mt-1 text-sm text-white/75">Compra, venta, inversión, desarrollo o asesoría especializada. Canalizamos tu solicitud con el enfoque correcto.</p>
            </div>
          </div>

          {propertyTitle && (
            <div className="mt-8 rounded-2xl border border-orange-200/30 bg-orange-300/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Consulta activa</p>
              <p className="mt-2 text-base font-semibold text-white">{decodeURIComponent(propertyTitle)}</p>
              <p className="mt-1 text-sm text-white/75">El formulario se enviará vinculado a esta propiedad.</p>
            </div>
          )}

          {serviceName && (
            <div className="mt-8 rounded-2xl border border-brand-200/30 bg-brand-400/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Servicio de interés</p>
              <p className="mt-2 text-base font-semibold text-white">{decodeURIComponent(serviceName)}</p>
              <p className="mt-1 text-sm text-white/75">Tu solicitud llegará vinculada a este servicio.</p>
            </div>
          )}
        </aside>

        <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm md:p-8 lg:p-9">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-600">Formulario</p>
            <h3 className="mt-3 font-heading text-3xl font-black text-slate-950 md:text-4xl">Cuéntanos qué necesitas</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">Completamos este formulario en menos de un minuto. Revisamos cada solicitud y te contactamos con una respuesta útil, no genérica.</p>
          </div>

          {brochureUrl && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
              <span className="mt-0.5 text-xl">📄</span>
              <div>
                <p className="text-sm font-bold text-brand-800">Descarga de brochure</p>
                <p className="mt-0.5 text-xs text-brand-700">Llena el formulario y al enviarlo se descargará el brochure de <strong>{serviceName}</strong> automáticamente.</p>
              </div>
            </div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Nombre completo</span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-400 focus:bg-white"
                  placeholder="Tu nombre"
                  value={form.name}
                  onChange={(e) => setValue('name', e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Correo electrónico</span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-400 focus:bg-white"
                  placeholder="nombre@correo.com"
                  type="email"
                  value={form.email}
                  onChange={(e) => setValue('email', e.target.value)}
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Teléfono / Celular</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-400 focus:bg-white"
                placeholder="10 dígitos (ej. 4421234567)"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) => setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                pattern="[0-9]{10}"
                title="Ingresa exactamente 10 dígitos sin espacios ni guiones"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Mensaje</span>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-400 focus:bg-white"
                rows={6}
                placeholder="Cuéntanos si buscas comprar, vender, invertir o recibir información puntual."
                value={form.message}
                onChange={(e) => setValue('message', e.target.value)}
                required
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
              <p className="text-sm font-semibold text-slate-800">Verificación anti-bot</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-700" htmlFor="contact-captcha">
                  ¿Cuánto es {captcha.left} + {captcha.right}?
                </label>
                <input
                  id="contact-captcha"
                  className="w-24 rounded-lg border border-slate-300 bg-white p-2 text-center text-slate-900 outline-none focus:border-brand-400"
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

            {/* Términos y condiciones */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500 cursor-pointer"
              />
              <span className="text-xs leading-relaxed text-slate-500">
                He leído y acepto los{' '}
                <a href="http://alterrarealestate.tuinmobiliaria.com.ar/Privacidad" target="_blank" rel="noreferrer" className="font-semibold text-brand-500 underline underline-offset-2 hover:text-brand-600">
                  términos y condiciones
                </a>{' '}
                y el{' '}
                <a href="http://alterrarealestate.tuinmobiliaria.com.ar/Privacidad" target="_blank" rel="noreferrer" className="font-semibold text-brand-500 underline underline-offset-2 hover:text-brand-600">
                  aviso de privacidad
                </a>{' '}
                de ARE Inmobiliaria.
              </span>
            </label>

            <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:justify-end">
              <button
                className="inline-flex min-w-[220px] items-center justify-center rounded-xl bg-brand-500 px-5 py-3 font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || !accepted || !captcha.answer}
                type="submit"
              >
                {loading ? 'Enviando...' : 'Enviar mensaje'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
