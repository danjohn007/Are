import { useState } from 'react';
import api from '../services/api';
import { FolderOpen, Loader2 } from 'lucide-react';

export default function ImageUpload({ value, onChange, label = 'Imagen' }) {
  const [preview, setPreview] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');

    // Mostrar preview local inmediato
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    // Subir al servidor
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.data.url;
      onChange(url);
      setPreview(url);
    } catch {
      setError('No se pudo subir la imagen. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <label
          className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-2 text-sm transition
            ${uploading ? 'border-gray-200 text-gray-400' : 'border-brand-500 text-brand-700 hover:bg-brand-50'}`}
        >
          {uploading
            ? <span className="flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Subiendo...</span>
            : <span className="flex items-center gap-1"><FolderOpen size={14} /> Elegir imagen</span>
          }
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>
        {preview && (
          <div className="relative">
            <img
              src={preview}
              alt="Vista previa"
              className="h-16 w-24 rounded-lg border object-cover shadow-sm"
            />
          </div>
        )}
        {!preview && (
          <span className="text-xs text-gray-400">JPG, PNG, WEBP o GIF · máx. 5MB</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
