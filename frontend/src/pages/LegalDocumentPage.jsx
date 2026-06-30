import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Shield } from 'lucide-react';
import api from '../services/api';

const CONFIG = {
  privacy: {
    key: 'legal_privacy',
    title: 'Aviso de privacidad',
    eyebrow: 'Documento legal',
    description: 'Consulta el aviso de privacidad vigente de ARE Real Estate.',
    icon: Shield,
  },
  terms: {
    key: 'legal_terms',
    title: 'Términos y condiciones',
    eyebrow: 'Documento legal',
    description: 'Consulta los términos y condiciones vigentes de ARE Real Estate.',
    icon: FileText,
  },
};

function isLegacyFileValue(value) {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) || /\.pdf($|[?#])/i.test(text) || /\/uploads\//i.test(text);
}

function formatLegalText(value) {
  const raw = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!raw || isLegacyFileValue(raw)) return [];

  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default function LegalDocumentPage({ type = 'privacy' }) {
  const config = CONFIG[type] || CONFIG.privacy;
  const Icon = config.icon;
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  const blocks = useMemo(() => formatLegalText(content), [content]);
  const hasLegacyFile = useMemo(() => isLegacyFileValue(content), [content]);

  useEffect(() => {
    let active = true;

    async function loadDocument() {
      setLoading(true);
      try {
        const res = await api.get('/site-content');
        const value = res.data?.data?.[config.key] || '';
        if (active) setContent(value);
      } catch {
        if (active) setContent('');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDocument();
    return () => { active = false; };
  }, [config.key]);

  return (
    <section className="section-shell py-10 md:py-14">
      <Link to="/contact" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition hover:text-brand-700">
        <ArrowLeft size={16} /> Volver al formulario
      </Link>

      <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-6 py-8 text-white md:px-8">
          <span className="font-subheading text-xs uppercase tracking-[0.22em] text-brand-300">{config.eyebrow}</span>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-200">
              <Icon size={24} />
            </span>
            <div>
              <h1 className="font-heading text-3xl font-black text-white md:text-4xl">{config.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80 md:text-base">{config.description}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 md:p-8">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
              Cargando documento...
            </div>
          ) : hasLegacyFile ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
              Este documento todavía está configurado como archivo. Para evitar botones de descarga, captura el texto desde el panel administrativo.
            </div>
          ) : blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600">
              Este documento todavía no está configurado desde el panel administrativo.
            </div>
          ) : (
            <article className="mx-auto max-w-4xl rounded-3xl border border-gray-100 bg-white px-5 py-7 shadow-sm md:px-10 md:py-10">
              <div className="mb-8 border-b border-gray-100 pb-5">
                <p className="font-subheading text-xs uppercase tracking-[0.22em] text-brand-500">ARE Real Estate</p>
                <h2 className="mt-2 font-heading text-2xl font-black text-slate-900 md:text-3xl">{config.title}</h2>
              </div>

              <div className="space-y-5 text-[15px] leading-8 text-slate-700 md:text-base">
                {blocks.map((block, index) => {
                  const normalized = block.trim();
                  const isHeading = normalized.length <= 90 && !normalized.includes('.') && /(^\d+\.|^[A-ZÁÉÍÓÚÑ\s]+$|:$)/.test(normalized);

                  if (isHeading) {
                    return (
                      <h3 key={`${normalized}-${index}`} className="pt-2 font-heading text-lg font-black text-slate-900">
                        {normalized.replace(/:$/, '')}
                      </h3>
                    );
                  }

                  return (
                    <p key={`${normalized}-${index}`} className="whitespace-pre-line">
                      {normalized}
                    </p>
                  );
                })}
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
