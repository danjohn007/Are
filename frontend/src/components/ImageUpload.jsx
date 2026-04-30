import { useRef, useState, useEffect } from 'react';
import api from '../services/api';
import { FolderOpen, Loader2, Trash2, Link as LinkIcon } from 'lucide-react';

/**
 * Extract YouTube video ID from any common YouTube URL format.
 * Returns null if the URL is not a YouTube video URL.
 */
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
      const shortsMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) return shortsMatch[1];
    }
  } catch {
    // not a valid URL
  }
  return null;
}

function youtubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export default function ImageUpload({ value, onChange, label = 'Imagen' }) {
  const [preview, setPreview] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const inputRef = useRef(null);

  // Sync preview when value prop changes (e.g., when loading an article to edit)
  useEffect(() => {
    setPreview(value || '');
  }, [value]);

  function clearImage() {
    setPreview('');
    setError('');
    setUrlInput('');
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

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

  function handleUrlSubmit() {
    const raw = urlInput.trim();
    if (!raw) return;
    setError('');

    const ytId = extractYouTubeId(raw);
    if (ytId) {
      const thumb = youtubeThumbnail(ytId);
      setPreview(thumb);
      onChange(thumb);
      setUrlInput('');
      setShowUrlInput(false);
      return;
    }

    // Plain image URL
    setPreview(raw);
    onChange(raw);
    setUrlInput('');
    setShowUrlInput(false);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>

      <div className="flex flex-wrap items-center gap-3">
        {/* File upload button */}
        <label
          className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-2 text-sm transition
            ${uploading ? 'border-gray-200 text-gray-400' : 'border-brand-500 text-brand-700 hover:bg-brand-50'}`}
        >
          {uploading
            ? <span className="flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Subiendo...</span>
            : <span className="flex items-center gap-1"><FolderOpen size={14} /> Elegir imagen</span>
          }
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>

        {/* URL / YouTube button */}
        {!preview && (
          <button
            type="button"
            onClick={() => setShowUrlInput((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <LinkIcon size={14} /> Pegar URL / YouTube
          </button>
        )}

        {/* Preview */}
        {preview && (
          <div className="flex items-center gap-2">
            <img
              src={preview}
              alt="Vista previa"
              className="h-16 w-24 rounded-lg border object-cover shadow-sm"
            />
            <button
              type="button"
              onClick={clearImage}
              disabled={uploading}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={13} /> Eliminar
            </button>
          </div>
        )}

        {!preview && !showUrlInput && (
          <span className="text-xs text-gray-400">JPG, PNG, WEBP, GIF o enlace de YouTube</span>
        )}
      </div>

      {/* URL input panel */}
      {showUrlInput && !preview && (
        <div className="flex gap-2">
          <input
            type="url"
            className="flex-1 rounded-lg border p-2 text-sm"
            placeholder="https://youtube.com/watch?v=... o URL de imagen"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUrlSubmit())}
            autoFocus
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Usar
          </button>
          <button
            type="button"
            onClick={() => { setShowUrlInput(false); setUrlInput(''); }}
            className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
