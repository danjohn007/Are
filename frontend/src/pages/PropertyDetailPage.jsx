import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../services/api';
import PropertyCard from '../components/PropertyCard';

const fallbackImage = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be';

const SITE_CONTACT = {
  name: 'are REAL ESTATE',
  email: 'info@are.mx',
  phoneLabel: '442 707 0872',
  phoneHref: 'tel:+524427070872',
  hours: 'Lunes–Viernes: 9am – 7pm',
  address: 'Prol. Bernardo Quintana No. 300 || Piso 14-A || Torre 57 || Centro Sur || CP 76190 || Querétaro, Qro.',
};

const API_BASE = (import.meta.env.VITE_API_URL || '/backare/api').replace(/\/+$/, '');

function buildPropertyAssetProxyUrl(propertyId, photoIndex) {
  return `${API_BASE}/properties/${encodeURIComponent(propertyId)}/asset/${encodeURIComponent(photoIndex)}`;
}

function normalizePropertyDescription(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  return text
    .replace(/(?:\r?\n|\s)*(?:sí|si)\s*,?\s*(?:lo\s+somos|nosotros\s+somos)\s*$/iu, '\n\nYes, we are')
    .replace(/yes\s*,?\s*we\s+are/giu, 'Yes, we are')
    .trim();
}

// ─── Property documents and generated PDF preview ─────────────────────────
function isUsableDocumentUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.pathname && parsed.pathname !== '/';
  } catch {
    return false;
  }
}

function normalizeTokkoFile(file, index = 0) {
  if (!file) return null;

  if (typeof file === 'string') {
    const url = file.trim();
    if (!isUsableDocumentUrl(url)) return null;
    return {
      url,
      title: `Documento ${index + 1}`,
      mimeType: '',
      isPdf: /\.pdf(?:$|[?#])/i.test(url),
    };
  }

  const url = [
    file.download_url,
    file.secure_url,
    file.url,
    file.href,
    file.file,
    file.path,
  ].find((value) => isUsableDocumentUrl(value))?.trim();

  if (!url) return null;

  const title = String(
    file.title || file.name || file.description || file.filename || `Documento ${index + 1}`
  ).trim();
  const mimeType = String(file.mime_type || file.content_type || file.type || '').toLowerCase();
  const isPdf = mimeType.includes('pdf')
    || /\.pdf(?:$|[?#])/i.test(url)
    || /(?:pdf|ficha|brochure)/i.test(title);

  return { url, title, mimeType, isPdf };
}

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url) {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function parseVideoInfo(video) {
  const url = video.url || video.player_url || '';
  const title = video.title || 'Ver video';
  const ytId = getYouTubeId(url);
  if (ytId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`,
      thumbUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      title,
      type: 'youtube',
    };
  }
  const vimeoId = getVimeoId(url);
  if (vimeoId) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
      thumbUrl: null,
      title,
      type: 'vimeo',
    };
  }
  return { embedUrl: url, thumbUrl: null, title, type: 'other' };
}

function formatValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') {
    return 'No disponible';
  }

  return `${value}${suffix}`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  // Accept numbers or strings like "120", "120.5", "120 m2", "120m²"
  const cleaned = String(value).replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = toNumber(value);
    if (number > 0) return number;
  }
  return 0;
}

function isInvalidTokkoDisplayValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === ''
    || normalized === 'array'
    || normalized === 'undefined'
    || normalized === 'null'
    || normalized.includes('arqus-alliance')
    || normalized.includes('mymemory warning')
    || normalized.includes('query length limit');
}

function hasDisplayValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && isInvalidTokkoDisplayValue(value)) return false;
  if (typeof value === 'number' && value <= 0) return false;
  if (typeof value === 'string' && /^0(?:[.,]0+)?$/.test(value.trim())) return false;
  return true;
}

function formatAge(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = toNumber(value);
  if (numeric === 0 && String(value).trim() === '0') return 'A estrenar';
  if (numeric > 0 && /^\d+(?:[.,]\d+)?$/.test(String(value).trim())) {
    return `${numeric.toLocaleString('es-MX')} año${numeric === 1 ? '' : 's'}`;
  }
  return value;
}


function parseGeo(value) {
  const n = toNumber(value);
  return n ? n : null;
}

const TOKKO_TRANSLATIONS = {
  // property_condition
  good: 'Buenas condiciones',
  good_condition: 'Buenas condiciones',
  excellent: 'Excelentes condiciones',
  excellent_condition: 'Excelentes condiciones',
  regular: 'Condiciones regulares',
  regular_condition: 'Condiciones regulares',
  bad: 'Necesita reparación',
  bad_condition: 'Necesita reparación',
  needs_repair: 'Necesita reparación',
  new: 'A estrenar',
  // situation
  forsale: 'En venta',
  for_sale: 'En venta',
  'for sale': 'En venta',
  rent: 'En renta',
  for_rent: 'En renta',
  'for rent': 'En renta',
  rented: 'Rentado',
  sold: 'Vendido',
  empty: 'Desocupado',
  vacant: 'Desocupado',
  unoccupied: 'Desocupado',
  occupied: 'Ocupado',
  available: 'Disponible',
  'owner occupied': 'Ocupado por el propietario',
  'tenant occupied': 'Ocupado por inquilino',
  // credit_eligible
  yes: 'Sí',
  no: 'No',
  true: 'Sí',
  false: 'No',
  'not specified': 'No especificado',
  unspecified: 'No especificado',
  'not available': 'No disponible',
  unknown: 'No especificado',
  none: 'Ninguno',
  'n a': 'No especificado',
  // disposition / land shape
  irregular: 'Irregular',
  rectangular: 'Rectangular',
  triangular: 'Triangular',
  // orientation / topography
  flat: 'Plano',
  slope: 'Con pendiente',
  corner: 'Esquina',
  // infrastructure / services (Tokko tags)
  sewage: 'Drenaje',
  electricity: 'Electricidad',
  'underground electricity': 'Electricidad subterránea',
  phone: 'Línea telefónica',
  internet: 'Internet',
  pavement: 'Pavimentación',
  'public lighting': 'Alumbrado público',
  'rainwater drainage': 'Drenaje pluvial',
  biodigesters: 'Biodigestores',
  biodigester: 'Biodigestor',
  water: 'Agua',
  gas: 'Gas',
  'natural gas': 'Gas natural',
  sewer: 'Alcantarillado',
  'potable water': 'Agua potable',
  'water tank': 'Cisterna',
  cistern: 'Cisterna',
  drainage: 'Drenaje',
  'street lighting': 'Alumbrado público',
  'paved road': 'Calle pavimentada',
  sidewalk: 'Banqueta',
  // amenity tags
  gym: 'Gimnasio',
  'swimming pool': 'Alberca',
  pool: 'Alberca',
  parking: 'Estacionamiento',
  elevator: 'Elevador',
  security: 'Seguridad',
  rooftop: 'Roof Garden',
  'roof garden': 'Roof Garden',
  lobby: 'Lobby',
  garden: 'Jardín',
  terrace: 'Terraza',
  balcony: 'Balcón',
  laundry: 'Lavandería',
  storage: 'Bodega',
  concierge: 'Concierge',
  playground: 'Área de juegos',
  'pet friendly': 'Pet Friendly',
  'co-working': 'Co-working',
  coworking: 'Co-working',
  bbq: 'Asador',
  grill: 'Asador',
  jacuzzi: 'Jacuzzi',
  sauna: 'Sauna',
  spa: 'Spa',
  cinema: 'Cine',
  'business center': 'Centro de negocios',
  'event room': 'Salón de eventos',
  'sports court': 'Cancha deportiva',
  'tennis court': 'Cancha de tenis',
  'basketball court': 'Cancha de basketball',
  'air conditioning': 'Aire acondicionado',
  heating: 'Calefacción',
  'solar panels': 'Paneles solares',
  generator: 'Planta de luz',
  clubhouse: 'Club House',
  'club house': 'Club House',
  reception: 'Recepción',
  conference: 'Sala de conferencias',
  'conference room': 'Sala de conferencias',
  // common property types
  house: 'Casa',
  'single family home': 'Casa Unifamiliar',
  'single family': 'Casa Unifamiliar',
  apartment: 'Departamento',
  land: 'Terreno',
  lot: 'Lote',
  office: 'Oficina',
  'office building': 'Edificio de Oficinas',
  building: 'Edificio',
  'residential building': 'Edificio Residencial',
  'commercial building': 'Edificio Comercial',
  warehouse: 'Bodega',
  commercial: 'Local Comercial',
  'commercial local': 'Local Comercial',
  'commercial space': 'Local Comercial',
  local: 'Local Comercial',
  'country club': 'Club de Campo',
  condominium: 'Condominio',
  'industrial condo': 'Condominio Industrial',
  'industrial condominium': 'Condominio Industrial',
  studio: 'Estudio',
  penthouse: 'Penthouse',
  villa: 'Villa',
  ranch: 'Rancho',
  farm: 'Finca',
  hacienda: 'Hacienda',
  hotel: 'Hotel',
  'mixed use': 'Uso Mixto',
  'retail space': 'Local Comercial',
  shop: 'Local Comercial',
  'industrial land': 'Terreno Industrial',
  'residential land': 'Terreno Residencial',
  'commercial land': 'Terreno Comercial',
  'industrial warehouse': 'Nave Industrial',
  duplex: 'Dúplex',
  townhouse: 'Casa en Condominio',
  loft: 'Loft',
  cabin: 'Cabaña',
  'beach house': 'Casa de Playa',
  chalet: 'Chalet',
  development: 'Desarrollo',
  residential: 'Residencial',
  'residential complex': 'Complejo Residencial',
  'housing complex': 'Complejo Habitacional',
  fractional: 'Fraccional',
  'fractional land': 'Terreno Fraccional',
  'gated community': 'Privada',
  'industrial park': 'Parque Industrial',
  'business park': 'Parque Empresarial',
  'shopping center': 'Centro Comercial',
  mall: 'Centro Comercial',
  'parking lot': 'Estacionamiento',
  'parking space': 'Cajón de Estacionamiento',
  suite: 'Suite',
  'serviced apartment': 'Apartamento de Servicio',
  'garden house': 'Casa con Jardín',
  // property_condition (variantes adicionales)
  'good condition': 'Buenas condiciones',
  'excellent condition': 'Excelentes condiciones',
  'regular condition': 'Condiciones regulares',
  'bad condition': 'Necesita reparación',
  'need repairs': 'Necesita reparación',
  'new building': 'Edificio nuevo',
  'to remodel': 'Para remodelar',
  'under construction': 'En construcción',
  'habitability certificate': 'Con cédula de habitabilidad',
  // situation (variante)
  transfer: 'Traspaso',
  // orientation (puntos cardinales)
  north: 'Norte',
  south: 'Sur',
  east: 'Oriente',
  west: 'Poniente',
  northeast: 'Noreste',
  northwest: 'Noroeste',
  southeast: 'Sureste',
  southwest: 'Suroeste',
  'north east': 'Noreste',
  'north west': 'Noroeste',
  'south east': 'Sureste',
  'south west': 'Suroeste',
  front: 'Frente',
  back: 'Trasero',
  interior: 'Interior',
  exterior: 'Exterior',
  // disposition (variantes)
  internal: 'Interior',
  lateral: 'Lateral',
  // construction_status
  finished: 'Terminado',
  completed: 'Terminado',
  construction: 'En construcción',
  presale: 'Pre-venta',
  'pre-sale': 'Pre-venta',
  'pre sale': 'Pre-venta',
  proyected: 'En planos',
  projected: 'En planos',
  planning: 'En planeación',
  delivery: 'Entrega',
  'sold out': 'Agotado',
  // tags Tokko específicos
  hall: 'Vestíbulo',
  'lobby hall': 'Vestíbulo',
  'fire detector': 'Detector de incendios',
  'fire alarm': 'Alarma contra incendios',
  'smoke detector': 'Detector de humo',
  'modern style': 'Estilo moderno',
  'colonial style': 'Estilo colonial',
  'contemporary style': 'Estilo contemporáneo',
  'one level': 'Un nivel',
  'single level': 'Un nivel',
  cctv: 'Cámaras CCTV',
  'electricity to be connected': 'Toma de electricidad',
  'water to be connected': 'Toma de agua',
  'gas to be connected': 'Toma de gas',
  'aluminium windows': 'Ventanas de aluminio',
  'aluminum windows': 'Ventanas de aluminio',
  'glass windows': 'Ventanas de vidrio',
  '24 hour security': 'Seguridad 24 horas',
  '24/7 security': 'Seguridad 24/7',
  'fixed garage': 'Cochera fija',
  lift: 'Elevador',
  'main boulevard': 'Sobre boulevard principal',
  'administrative office building': 'Edificio de oficinas administrativas',
  'drinking water': 'Agua potable',
  'night security': 'Vigilancia nocturna',
  'internal land': 'Terreno interior',
  'private security company': 'Empresa de seguridad privada',
  'good rental potential': 'Buen potencial de renta',
  'quiet location': 'Zona tranquila',
  'security grills': 'Rejas de seguridad',
  'security grill': 'Reja de seguridad',
  'concrete floors': 'Pisos de concreto',
  'concrete floor': 'Piso de concreto',
  'trifasic energy': 'Energía trifásica',
  'three phase energy': 'Energía trifásica',
  'access control': 'Control de acceso',
  'maintenance service': 'Servicio de mantenimiento',
  'issue invoice': 'Factura disponible',
  store: 'Bodega',
  'entrance security': 'Seguridad en acceso',
  'immediate deed': 'Escrituración inmediata',
  'direct sale': 'Venta directa',
  condomini: 'Condominio',
  'solar heater': 'Calentador solar',
  'water cistern': 'Cisterna de agua',
  'electric plant': 'Planta de luz',
  'backup power': 'Energía de respaldo',
  'natural ventilation': 'Ventilación natural',
  'cross ventilation': 'Ventilación cruzada',
  'wood floors': 'Pisos de madera',
  'marble floors': 'Pisos de mármol',
  'porcelain floors': 'Pisos de porcelanato',
  'laminated floors': 'Pisos laminados',
  'ceramic floors': 'Pisos de cerámica',
  'granite countertops': 'Encimeras de granito',
  'marble countertops': 'Encimeras de mármol',
  'quartz countertops': 'Encimeras de cuarzo',
  'stainless steel': 'Acero inoxidable',
  'double height': 'Doble altura',
  'high ceilings': 'Techos altos',
  skylight: 'Claraboya',
  'panoramic view': 'Vista panorámica',
  'sea view': 'Vista al mar',
  'lake view': 'Vista al lago',
  'pool view': 'Vista a la alberca',
  'garden view': 'Vista al jardín',
  'bay windows': 'Ventanales',
  'electric blinds': 'Persianas eléctricas',
  curtains: 'Cortinas',
  'dressing room': 'Vestidor',
  'utility room': 'Cuarto de utilería',
  'wine cellar': 'Cava de vinos',
  'home theater': 'Home Theater',
  'home office': 'Home Office',
  'private pool': 'Alberca privada',
  'shared pool': 'Alberca compartida',
  'heated pool': 'Alberca climatizada',
  'infinity pool': 'Alberca infinity',
  'adults pool': 'Alberca para adultos',
  'kids pool': 'Alberca infantil',
  'mini gym': 'Mini gimnasio',
  'yoga room': 'Sala de yoga',
  'pilates room': 'Sala de pilates',
  'massage room': 'Sala de masajes',
  'bicycle parking': 'Estacionamiento de bicicletas',
  'bike rack': 'Rack de bicicletas',
  'electric car charger': 'Cargador para auto eléctrico',
  'ev charger': 'Cargador para auto eléctrico',
  'shuttle service': 'Servicio de transporte',
  'valet parking': 'Valet parking',
  'storage unit': 'Cuarto de bodega',
  'package room': 'Cuarto de paquetes',
  'trash chute': 'Ducto de basura',
  recycling: 'Reciclaje',
  'water treatment': 'Tratamiento de agua',
  'rainwater collection': 'Captación de agua pluvial',
  'led lighting': 'Iluminación LED',
  'energy efficient': 'Eficiencia energética',
  'leed certified': 'Certificación LEED',
  'earthquake resistant': 'Resistente a sismos',
  'loading dock': 'Andén de carga',
  'freight elevator': 'Elevador de carga',
  'office space': 'Espacio de oficinas',
  'open office': 'Oficina abierta',
  'private office': 'Oficina privada',
  'meeting room': 'Sala de reuniones',
  boardroom: 'Sala de juntas',
  cafeteria: 'Cafetería',
  restaurant: 'Restaurante',
  'convenience store': 'Tienda de conveniencia',
  pharmacy: 'Farmacia',
  atm: 'Cajero automático',
  'fitness center': 'Gimnasio',
  'health club': 'Club de salud',
  'beauty salon': 'Salón de belleza',
  'dry cleaning': 'Tintorería',
};

function translateTokkoValue(value) {
  if (value === null || value === undefined || value === '') return value;
  if (isInvalidTokkoDisplayValue(value)) return null;
  const normalized = String(value).toLowerCase().trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const translated = TOKKO_TRANSLATIONS[normalized] ?? value;
  return isInvalidTokkoDisplayValue(translated) ? null : translated;
}

function categorizePdfTags(tags = []) {
  const translated = tags
    .map((tag) => translateTokkoValue(tag))
    .filter((tag) => hasDisplayValue(tag))
    .map((tag) => String(tag).trim());

  const servicePattern = /electric|internet|tel[eé]fono|agua|gas|drenaje|alcantarillado|alumbrado|paviment|seguridad|cctv|vigilancia|mantenimiento|planta de luz|energ[ií]a|cisterna/i;
  const spacePattern = /baño|bodega|patio|terraza|jard[ií]n|rec[aá]mara|cocina|sala|comedor|oficina|lobby|vest[ií]bulo|roof|estacionamiento|cochera|balc[oó]n|and[eé]n|local|sal[oó]n/i;

  const services = [];
  const spaces = [];
  const features = [];

  translated.forEach((tag) => {
    if (servicePattern.test(tag)) services.push(tag);
    else if (spacePattern.test(tag)) spaces.push(tag);
    else features.push(tag);
  });

  return {
    services: [...new Set(services)],
    spaces: [...new Set(spaces)],
    features: [...new Set(features)],
  };
}

function MapTiles({ lat, lon, zoom = 15 }) {
  const TILE = 256;
  const n = Math.pow(2, zoom);
  const tileXF = (lon + 180) / 360 * n;
  const latRad = (lat * Math.PI) / 180;
  const tileYF = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  const cx = Math.floor(tileXF);
  const cy = Math.floor(tileYF);
  const fracX = tileXF - cx;
  const fracY = tileYF - cy;
  const R = 1; // tiles radius: 3x3 grid
  const tiles = [];
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++)
      tiles.push({ tx: cx + dx, ty: cy + dy, dx, dy });
  const pointX = R * TILE + fracX * TILE;
  const pointY = R * TILE + fracY * TILE;
  const gridSize = (2 * R + 1) * TILE;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-slate-100" style={{ height: '288px' }}>
      <div style={{ position: 'absolute', width: gridSize, height: gridSize, left: `calc(50% - ${pointX}px)`, top: `calc(50% - ${pointY}px)` }}>
        {tiles.map(({ tx, ty, dx, dy }) => (
          <img
            key={`${dx}-${dy}`}
            src={`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`}
            alt=""
            draggable={false}
            style={{ position: 'absolute', left: (dx + R) * TILE, top: (dy + R) * TILE, width: TILE, height: TILE }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '18px' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{ width: 36, height: 36, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
          <path fill="#BC561D" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      <div style={{ position: 'absolute', bottom: 4, right: 8, fontSize: 10, color: '#94a3b8', opacity: 0.8 }}>
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>OpenStreetMap</a>
      </div>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfObjectUrl, setPdfObjectUrl] = useState('');
  const [pdfFilename, setPdfFilename] = useState('ficha-propiedad.pdf');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');


  useEffect(() => {
    async function fetchItem() {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/properties/${id}`);
        const nextItem = response.data.data || null;
        setItem(nextItem);
        setActiveIndex(0);
        setPdfPreviewOpen(false);
        setPdfError('');
        setPdfObjectUrl('');
        setPdfFilename('ficha-propiedad.pdf');
      } catch (_error) {
        setError('No pudimos cargar este registro.');
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  useEffect(() => () => {
    if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
  }, [pdfObjectUrl]);

  useEffect(() => {
    if (!pdfPreviewOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPdfPreviewOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [pdfPreviewOpen]);

  useEffect(() => {
    if (!item || item.listing_kind !== 'development') return;
    let cancelled = false;
    async function fetchUnits() {
      setLoadingUnits(true);
      try {
        const res = await api.get(`/properties/${id}/units`);
        if (!cancelled) setUnits(res.data.data || []);
      } catch {
        if (!cancelled) setUnits([]);
      } finally {
        if (!cancelled) setLoadingUnits(false);
      }
    }
    fetchUnits();
    return () => { cancelled = true; };
  }, [item, id]);

  if (loading) {
    return (
      <section className="section-shell py-16">
        <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          Cargando detalle...
        </div>
      </section>
    );
  }

  if (error || !item) {
    return (
      <section className="section-shell py-16">
        <div className="rounded-3xl border border-red-100 bg-red-50 p-10 text-center text-red-700 shadow-sm">
          {error || 'No encontramos este registro.'}
        </div>
      </section>
    );
  }

  const isDevelopment = item.listing_kind === 'development';
  const badgeClass = isDevelopment ? 'bg-brand-500 text-white' : item.operation_type === 'renta' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white';
  const badgeLabel = isDevelopment ? 'Desarrollo' : item.operation_type === 'renta' ? 'En Renta' : 'En Venta';
  const backPath = isDevelopment ? '/developments' : '/properties';
  const backLabel = isDevelopment ? 'Volver a desarrollos' : 'Volver a propiedades';
  const photos = item.photos?.length ? item.photos : [{ image: item.image_url || fallbackImage, original: item.image_url || fallbackImage, thumb: item.image_url || fallbackImage }];
  const normalizedActiveIndex = Math.min(activeIndex, Math.max(photos.length - 1, 0));
  const activePhoto = photos[normalizedActiveIndex] || photos[0];
  const activeImage = activePhoto?.original || activePhoto?.image || item.image_url || fallbackImage;
  const goToPreviousImage = () => setActiveIndex((current) => (current === 0 ? photos.length - 1 : current - 1));
  const goToNextImage = () => setActiveIndex((current) => (current === photos.length - 1 ? 0 : current + 1));
  const geoLat = parseGeo(item.details?.geo_lat);
  const geoLong = parseGeo(item.details?.geo_long);
  const hasCoords = geoLat !== null && geoLong !== null;
  const mapLink = hasCoords ? `https://www.google.com/maps?q=${geoLat},${geoLong}` : null;
  const primaryArea = firstPositiveNumber(
    item.area,
    item.details?.total_surface,
    item.details?.roofed_surface,
    item.details?.private_area,
    item.details?.unroofed_surface,
  );
  const explicitPricePerM2 = toNumber(item.details?.price_per_m2);
  const calculatedPricePerM2 = toNumber(item.price) > 0 && primaryArea > 0 ? toNumber(item.price) / primaryArea : 0;
  const pricePerM2 = explicitPricePerM2 > 0 ? explicitPricePerM2 : calculatedPricePerM2;
  const displayPrice = toNumber(item.price) > 0 ? `$${toNumber(item.price).toLocaleString('es-MX')} MXN` : 'Consultar precio';
  const displayDescription = normalizePropertyDescription(item.description);
  const openPropertyPdfPreview = async () => {
    if (pdfLoading) return;

    setPdfLoading(true);
    setPdfError('');
    try {
      const tagGroups = categorizePdfTags(item.tags || []);
      const pdfPhotoSource = item.photos?.length
        ? item.photos
        : item.image_url
          ? [{ original: item.image_url }]
          : [];
      const photoUrls = pdfPhotoSource
        .map((photo, photoIndex) => ({
          source: photo?.original || photo?.image || photo?.thumb,
          photoIndex,
        }))
        .filter(({ source }) => typeof source === 'string' && /^https?:\/\//i.test(source))
        .map(({ photoIndex }) => buildPropertyAssetProxyUrl(id, photoIndex));

      const general = [
        { label: 'Plantas', value: item.details?.floors_amount || item.details?.floor },
        { label: 'Zonificación', value: item.details?.zonification },
        { label: 'Orientación', value: translateTokkoValue(item.details?.orientation) },
        { label: 'Condición', value: translateTokkoValue(item.details?.property_condition) },
        { label: 'Antigüedad', value: formatAge(item.details?.age) },
        { label: 'Situación', value: translateTokkoValue(item.details?.situation) },
        { label: 'Baños', value: toNumber(item.bathrooms) > 0 ? toNumber(item.bathrooms) : null },
        { label: 'Estacionamientos', value: toNumber(item.details?.parking_lot_amount) > 0 ? toNumber(item.details?.parking_lot_amount) : null },
      ].filter((entry) => hasDisplayValue(entry.value));

      const surfaces = [
        { label: 'Terreno', value: primaryArea > 0 ? `${primaryArea.toLocaleString('es-MX')} m²` : null },
        { label: 'Superficie cubierta', value: toNumber(item.details?.roofed_surface) > 0 ? `${toNumber(item.details?.roofed_surface).toLocaleString('es-MX')} m²` : null },
        { label: 'Fondo', value: toNumber(item.details?.depth_measure || item.details?.land_length) > 0 ? `${toNumber(item.details?.depth_measure || item.details?.land_length).toLocaleString('es-MX')} m` : null },
        { label: 'Frente', value: toNumber(item.details?.front_measure || item.details?.land_width) > 0 ? `${toNumber(item.details?.front_measure || item.details?.land_width).toLocaleString('es-MX')} m` : null },
      ].filter((entry) => hasDisplayValue(entry.value));

      const { createPropertyPdf } = await import('../utils/propertyPdf.js');
      const result = await createPropertyPdf({
        reference: item.reference_code || `ARE-${id}`,
        propertyType: translateTokkoValue(item.property_type) || 'Propiedad',
        title: item.title || 'Propiedad',
        location: item.location_full || item.city || item.address || '',
        address: item.address || item.location_full || item.city || '',
        operation: badgeLabel.replace(/^En\s+/i, ''),
        price: displayPrice,
        description: displayDescription,
        general,
        surfaces,
        services: tagGroups.services,
        spaces: tagGroups.spaces.length ? tagGroups.spaces : tagGroups.features.slice(0, 6),
        photoUrls,
        logoUrl: `${import.meta.env.BASE_URL}color_are.png`,
        contactName: SITE_CONTACT.name,
        contactPhone: SITE_CONTACT.phoneLabel,
        contactEmail: SITE_CONTACT.email,
        website: 'are.mx',
      });

      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
      const nextObjectUrl = URL.createObjectURL(result.blob);
      setPdfObjectUrl(nextObjectUrl);
      setPdfFilename(result.filename);
      setPdfPreviewOpen(true);
    } catch (error) {
      console.error('No fue posible generar la ficha PDF:', error);
      setPdfError('No fue posible generar la ficha PDF. Intenta nuevamente en unos segundos.');
      setPdfPreviewOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const detailEntries = [
    ['Tipo', translateTokkoValue(item.property_type)],
    ['Referencia', item.reference_code],
    ['Operación', badgeLabel],
    ['Ubicación', item.location_full || item.address || item.city],
    ['Dirección', item.address],
    ['Código postal', item.details?.zip_code],
    ['Superficie total', primaryArea > 0 ? `${primaryArea.toLocaleString('es-MX')} m²` : null],
    ['Superficie techada', toNumber(item.details?.roofed_surface) > 0 ? `${toNumber(item.details.roofed_surface).toLocaleString('es-MX')} m²` : null],
    ['Superficie sin techar', toNumber(item.details?.unroofed_surface) > 0 ? `${toNumber(item.details.unroofed_surface).toLocaleString('es-MX')} m²` : null],
    ['Área privada', toNumber(item.details?.private_area) > 0 ? `${toNumber(item.details.private_area).toLocaleString('es-MX')} m²` : null],
    ['Estacionamientos', toNumber(item.details?.parking_lot_amount) > 0 ? toNumber(item.details?.parking_lot_amount) : null],
    ['Recámaras', toNumber(item.bedrooms) > 0 ? toNumber(item.bedrooms) : null],
    ['Baños', toNumber(item.bathrooms) > 0 ? toNumber(item.bathrooms) : null],
    ['Condición', translateTokkoValue(item.details?.property_condition)],
    ['Situación', translateTokkoValue(item.details?.situation)],
    ['Antigüedad', formatAge(item.details?.age)],
    ['Fecha de construcción', item.details?.construction_date],
    ['Gastos / mantenimiento', toNumber(item.details?.expenses) > 0 ? `$${toNumber(item.details.expenses).toLocaleString('es-MX')} MXN` : null],
  ].filter(([, value]) => hasDisplayValue(value));

  const generalInfo = [
    ['Zonificación', item.details?.zonification],
    ['$ x m²', pricePerM2 > 0 ? `$${pricePerM2.toLocaleString('es-MX', { maximumFractionDigits: 2 })}` : null],
    ['Forma de terreno', translateTokkoValue(item.details?.disposition)],
    ['Orientación', translateTokkoValue(item.details?.orientation)],
    ['Crédito elegible', translateTokkoValue(item.details?.credit_eligible)],
  ].filter(([, value]) => hasDisplayValue(value));



  return (
    <section className="section-shell py-14 lg:py-16">
      <Link to={backPath} className="mb-8 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand-500 hover:text-brand-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        {backLabel}
      </Link>

      <div className="grid items-start gap-8 lg:grid-cols-2 xl:gap-10">
        <div className="space-y-6 lg:space-y-7">
        <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-slate-100">
            <img
              src={activeImage}
              alt={item.title}
              className="h-[320px] w-full object-cover md:h-[440px] transition-opacity duration-300"
            />

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPreviousImage}
                  aria-label="Imagen anterior"
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-slate-900 shadow-lg transition hover:bg-white"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goToNextImage}
                  aria-label="Imagen siguiente"
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-slate-900 shadow-lg transition hover:bg-white"
                >
                  ›
                </button>
                {/* Counter badge */}
                <span className="absolute bottom-4 right-4 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-semibold text-white">
                  {normalizedActiveIndex + 1} / {photos.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
              {photos.map((photo, index) => {
                const thumb = photo.thumb || photo.image || photo.original;
                const isActive = index === normalizedActiveIndex;
                return (
                  <button
                    key={`thumb-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                      isActive ? 'border-brand-500 opacity-100 scale-105' : 'border-transparent opacity-60 hover:opacity-90'
                    }`}
                  >
                    <img
                      src={thumb}
                      alt={`Foto ${index + 1}`}
                      className="h-16 w-20 object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Videos below photo strip */}
          {item.videos?.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-4">
              <h3 className="mb-3 font-heading text-base font-bold text-slate-950">Videos</h3>
              <div className="flex flex-col gap-3">
                {item.videos.map((video, index) => {
                  const info = parseVideoInfo(video);
                  const externalUrl = video.url || video.player_url || '';
                  // Skip non-video URLs (WhatsApp, etc.)
                  if (!externalUrl || /wa\.me|whatsapp\.com/i.test(externalUrl)) return null;
                  if (info.thumbUrl) {
                    return (
                      <div key={index} className="overflow-hidden rounded-2xl border border-gray-200 bg-slate-900">
                        <a href={externalUrl} target="_blank" rel="noreferrer" className="group relative block aspect-video w-full">
                          <img src={info.thumbUrl} alt={info.title} className="h-full w-full object-cover opacity-80 transition group-hover:opacity-70" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-3xl text-slate-900 shadow-lg transition group-hover:scale-110">▶</span>
                          </div>
                        </a>
                        <div className="flex items-center justify-between gap-3 border-t border-slate-700 px-4 py-3">
                          <p className="truncate text-sm font-semibold text-slate-200">{info.title}</p>
                          <a href={externalUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600">
                            Ver en YouTube ↗
                          </a>
                        </div>
                      </div>
                    );
                  }
                  const platformLabel = info.type === 'vimeo' ? 'Vimeo' : 'video';
                  return (
                    <div key={index} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-4">
                      <p className="truncate text-sm font-semibold text-slate-700">{info.title}</p>
                      <a href={externalUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600">
                        Ver en {platformLabel} ↗
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-6 p-6 md:p-7">
            {detailEntries.length > 0 && (
              <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="font-heading text-xl font-bold text-slate-950">Detalles de la propiedad</h2>
                <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-5 text-sm text-gray-700 sm:grid-cols-2">
                  {detailEntries.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {generalInfo.length > 0 && (
              <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="font-heading text-xl font-bold text-slate-950">Información general</h2>
                <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-5 text-sm text-gray-700 sm:grid-cols-2">
                  {generalInfo.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

        </div>

        {item.tags?.length > 0 && (
          <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
            <h2 className="font-heading text-xl font-bold text-slate-950">
              {isDevelopment ? 'Características' : 'Amenidades y características'}
            </h2>
            {isDevelopment ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {item.tags.map((tag) => (
                  <li key={tag} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-slate-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold">✓</span>
                    {translateTokkoValue(tag)}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
                    {translateTokkoValue(tag)}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}


        <aside className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
          <h3 className="font-heading text-xl font-bold text-slate-950">Contacto</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{SITE_CONTACT.name}</p>
            <p>
              <a href={`mailto:${SITE_CONTACT.email}`} className="text-brand-600 hover:underline">{SITE_CONTACT.email}</a>
            </p>
            <p>
              <a href={SITE_CONTACT.phoneHref} className="text-brand-600 hover:underline">{SITE_CONTACT.phoneLabel}</a>
            </p>
            <p>{SITE_CONTACT.hours}</p>
            <p>{SITE_CONTACT.address}</p>
          </div>
        </aside>

        </div>

        <div className="space-y-6 lg:space-y-7">
          <div className="rounded-[2rem] border border-gray-100 bg-white p-7 shadow-sm md:p-8">
            <span className={`inline-flex rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] ${badgeClass}`}>
              {badgeLabel}
            </span>
            <h1 className="mt-5 font-heading text-3xl font-black text-slate-950 md:text-4xl">{item.title}</h1>
            <p className="mt-3 text-base text-gray-500">{item.location_full || item.address || item.city || 'Ubicación no disponible'}</p>


            {(() => {
              const areaNum = primaryArea;
              const beds = toNumber(item.bedrooms || 0);
              const baths = toNumber(item.bathrooms || 0);
              const parts = [];
              if (item.city) parts.push(`Ciudad: ${item.city}`);
              if (areaNum > 0) parts.push(`Terreno: ${areaNum.toLocaleString('es-MX')} m²`);
              if (beds > 0) parts.push(`Recámaras: ${beds}`);
              if (baths > 0) parts.push(`Baños: ${baths}`);

              if (parts.length === 0) return null;

              return (
                <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
                  {parts.map((p) => (
                    <span key={p} className="rounded-full bg-gray-100 px-4 py-2">{p}</span>
                  ))}
                </div>
              );
            })()}

            <div className="mt-8 rounded-2xl bg-slate-950 px-6 py-5 text-white">
              <p className="text-xs uppercase tracking-[0.3em] text-white/85">Precio</p>
              <p className="mt-2 text-3xl font-black text-white">
                {displayPrice}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={`/contact?property_id=${item.id}&property_title=${encodeURIComponent(item.title || 'esta propiedad')}`}
                className="inline-flex rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-700"
              >
                Solicitar información
              </Link>
              <button
                type="button"
                onClick={openPropertyPdfPreview}
                disabled={pdfLoading}
                title="Generar vista previa de la ficha en PDF"
                className={`inline-flex items-center gap-2 rounded-xl border px-6 py-3 font-semibold shadow-sm transition ${
                  !pdfLoading
                    ? 'border-gray-200 bg-white text-slate-700 hover:border-brand-500 hover:text-brand-500'
                    : 'cursor-wait border-gray-100 bg-gray-50 text-gray-400'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                {pdfLoading ? 'Generando ficha...' : 'Vista previa de ficha PDF'}
              </button>
            </div>
            {pdfError && (
              <p className="mt-3 text-sm font-medium text-red-600">{pdfError}</p>
            )}

          </div>

          <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
            <h2 className="font-heading text-xl font-bold text-slate-950">Descripción</h2>
            <p className="mt-3 whitespace-pre-line break-words text-base leading-7 text-gray-700">
              {displayDescription || 'Sin descripción disponible por el momento.'}
            </p>
            {/* Botón visible en móvil (oculto en pantallas grandes donde ya aparece en el panel derecho) */}
            <Link
              to={`/contact?property_id=${item.id}&property_title=${encodeURIComponent(item.title || 'esta propiedad')}`}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-brand-700 lg:hidden"
            >
              Solicitar más información
            </Link>
          </section>

          {(hasCoords || item.address || item.location_full || item.city) && (
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-heading text-xl font-bold text-slate-950">Ubicación</h3>
                <a
                  href={mapLink || `https://www.google.com/maps/search/${encodeURIComponent(item.address || item.location_full || item.city || '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-brand-700 transition hover:text-brand-500"
                >
                  Abrir en Google Maps ↗
                </a>
              </div>
              {hasCoords ? (
                <a href={mapLink} target="_blank" rel="noreferrer" className="block">
                  <MapTiles lat={geoLat} lon={geoLong} />
                </a>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-6 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <p className="text-sm text-slate-500">{item.address || item.location_full || item.city || 'Ubicación no especificada'}</p>
                </div>
              )}
              <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Nota importante: las medidas e información se consideran referenciales y deben validarse con documentación vigente.
              </p>
            </section>
          )}



          {/* Development-specific block */}
          {isDevelopment && (
            <div className="rounded-[2rem] border-2 border-brand-100 bg-brand-50 p-6 md:p-7">
              <h2 className="font-heading text-xl font-bold text-slate-950 mb-4">Información del desarrollo</h2>
              <div className="flex flex-wrap gap-4">
                {(item.details?.unit_amount || item.details?.available_units) && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-xl font-black text-white">
                      {item.details?.available_units || item.details?.unit_amount}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Unidades</p>
                      <p className="font-bold text-slate-900">disponibles</p>
                    </div>
                  </div>
                )}
                {item.details?.floors_amount && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl font-black text-white">
                      {item.details.floors_amount}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pisos</p>
                      <p className="font-bold text-slate-900">en el edificio</p>
                    </div>
                  </div>
                )}
                {item.details?.construction_status && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Estado</p>
                      <p className="font-bold text-slate-900">{translateTokkoValue(item.details.construction_status)}</p>
                    </div>
                  </div>
                )}
                {item.details?.delivery_date && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fecha de entrega</p>
                      <p className="font-bold text-slate-900">{item.details.delivery_date}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Units list for developments */}
          {isDevelopment && (loadingUnits || units.length > 0) && (
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
              <h2 className="font-heading text-xl font-bold text-slate-950 mb-1">Unidades disponibles</h2>
              {loadingUnits ? (
                <p className="mt-4 text-sm text-gray-400">Cargando unidades...</p>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-5">{units.length} unidad{units.length !== 1 ? 'es' : ''} en este desarrollo</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {units.map((unit) => (
                      <PropertyCard key={unit.id} property={unit} />
                    ))}
                  </div>
                </>
              )}
            </section>
          )}





          {item.files?.length > 0 && (
            <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-7">
              <h2 className="font-heading text-xl font-bold text-slate-950">Archivos</h2>
              <div className="mt-4 space-y-3">
                {item.files.map((file, index) => {
                  const normalizedFile = normalizeTokkoFile(file, index);
                  if (!normalizedFile) return null;
                  return (
                    <a
                      key={`${normalizedFile.url}-${index}`}
                      href={normalizedFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      {normalizedFile.title || `Documento ${index + 1}`}
                    </a>
                  );
                })}
              </div>
            </section>
          )}


        </div>
      </div>

      {pdfPreviewOpen && pdfObjectUrl && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de la ficha PDF"
          onClick={() => setPdfPreviewOpen(false)}
        >
          <div
            className="flex h-[calc(100dvh-1rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-[calc(100dvh-2rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Ficha de propiedad</p>
                <h3 className="mt-1 truncate font-heading text-base font-bold text-slate-950 sm:text-lg">Vista previa - {item.title}</h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={pdfObjectUrl}
                  download={pdfFilename}
                  className="inline-flex rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
                >
                  Descargar PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPdfPreviewOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-xl text-slate-600 transition hover:bg-gray-100"
                  aria-label="Cerrar vista previa"
                >
                  ×
                </button>
              </div>
            </div>
            <iframe
              src={`${pdfObjectUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              title="Vista previa de la ficha PDF de la propiedad"
              className="min-h-0 w-full flex-1 bg-slate-200"
            />
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}