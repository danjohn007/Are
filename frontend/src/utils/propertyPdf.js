import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN = 11;
const LEFT_WIDTH = 138;
const GAP = 4;
const RIGHT_X = MARGIN + LEFT_WIDTH + GAP;
const RIGHT_WIDTH = PAGE_WIDTH - MARGIN - RIGHT_X;
const BRAND_ORANGE = [188, 86, 29];
const TOKKO_RED = [226, 73, 56];
const TOKKO_CYAN = [5, 164, 183];
const DARK = [46, 46, 46];
const MUTED = [94, 94, 94];
const LIGHT_LINE = [218, 218, 218];

function cleanText(value) {
  return String(value ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
}

function cleanFilename(value) {
  const normalized = cleanText(value || 'propiedad')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'propiedad';
}

const EMPTY_VALUES = new Set([
  '', '-', '--', '---', 'n/a', 'na', 'nd',
  'array', 'undefined', 'null',
  'no disponible', 'no especificado', 'sin especificar',
  'sin informacion', 'sin información', 'desconocido',
  'agregar un valor o medida',
]);

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;

  const text = cleanText(value);
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return !EMPTY_VALUES.has(normalized)
    && !/^[-—–]+$/.test(text)
    && !/^\s*[A-ZÁÉÍÓÚÑ]\s*:\s*[^\n]{1,180}$/u.test(text)
    && !/^0(?:[.,]0+)?(?:\s*(mxn|usd|m2|m²|m|%))?$/i.test(text);
}

function drawSectionHeading(doc, title, x, y, width) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(...TOKKO_RED);
  doc.text(cleanText(title).toUpperCase(), x, y);
  doc.setDrawColor(...LIGHT_LINE);
  doc.setLineWidth(0.25);
  doc.line(x, y + 2.2, x + width, y + 2.2);
  return y + 6;
}

function drawValueGrid(doc, entries, x, y, width, columns = 3) {
  const valid = entries.filter((entry) => entry && hasValue(entry.value));
  if (!valid.length) return y;

  const colWidth = width / columns;
  const rowHeight = 5.1;
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK);

  valid.forEach((entry, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const px = x + col * colWidth;
    const py = y + row * rowHeight;
    const label = cleanText(entry.label);
    const value = cleanText(entry.value);

    doc.setFont('helvetica', 'normal');
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.text(`${label}:`, px, py);
    doc.setFont('helvetica', 'bold');
    const available = Math.max(10, colWidth - labelWidth - 2);
    const clipped = doc.splitTextToSize(value, available)[0] || value;
    doc.text(clipped, px + labelWidth, py);
  });

  const rows = Math.ceil(valid.length / columns);
  return y + rows * rowHeight + 1.5;
}

function drawKeyValueList(doc, entries, x, y, width) {
  const valid = entries.filter((entry) => entry && hasValue(entry.value));
  if (!valid.length) return y;

  let cursorY = y;
  valid.forEach((entry) => {
    const label = cleanText(entry.label);
    const value = cleanText(entry.value);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(...MUTED);
    doc.text(`${label}:`, x, cursorY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...DARK);
    const labelWidth = Math.min(36, doc.getTextWidth(`${label}: `) + 2);
    const lines = doc.splitTextToSize(value, width - labelWidth).slice(0, 3);
    doc.text(lines, x + labelWidth, cursorY, { lineHeightFactor: 1.15 });
    cursorY += Math.max(4.6, lines.length * 3.4 + 1.2);
  });

  return cursorY + 1;
}

function drawSimpleList(doc, items, x, y, width, columns = 3) {
  const valid = items.map(cleanText).filter(Boolean);
  if (!valid.length) return y;

  const colWidth = width / columns;
  const rowHeight = 5.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK);

  valid.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const px = x + col * colWidth;
    const py = y + row * rowHeight;
    const clipped = doc.splitTextToSize(item, colWidth - 3)[0] || item;
    doc.text(clipped, px, py);
  });

  return y + Math.ceil(valid.length / columns) * rowHeight + 1.5;
}

function loadImageElement(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = objectUrl;
  });
}

async function fetchImageAsCoveredJpeg(url, targetRatio = 1.5, maxWidth = 1400) {
  if (!url) return null;

  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Invalid image response');

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImageElement(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error('Empty image');

    const canvas = document.createElement('canvas');
    const canvasWidth = Math.min(maxWidth, Math.max(800, sourceWidth));
    const canvasHeight = Math.max(500, Math.round(canvasWidth / targetRatio));
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const sourceRatio = sourceWidth / sourceHeight;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetRatio;
      sy = (sourceHeight - sh) / 2;
    }

    const context = canvas.getContext('2d');
    context.fillStyle = '#f1f1f1';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.drawImage(image, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fetchImageAsPng(url, maxWidth = 1200) {
  if (!url) return null;

  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Invalid image response');

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImageElement(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function drawPlaceholder(doc, x, y, width, height, label = 'Imagen no disponible') {
  doc.setFillColor(242, 242, 242);
  doc.rect(x, y, width, height, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.rect(x, y, width, height);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(145, 145, 145);
  doc.text(label, x + width / 2, y + height / 2, { align: 'center' });
}

function drawMapPanel(doc, x, y, width, height, address) {
  doc.setFillColor(242, 245, 247);
  doc.rect(x, y, width, height, 'F');
  doc.setDrawColor(203, 213, 220);
  doc.setLineWidth(0.8);

  const roadLines = [
    [x - 5, y + height * 0.25, x + width + 5, y + height * 0.45],
    [x - 4, y + height * 0.72, x + width + 4, y + height * 0.52],
    [x + width * 0.18, y - 4, x + width * 0.42, y + height + 4],
    [x + width * 0.62, y - 4, x + width * 0.78, y + height + 4],
  ];
  roadLines.forEach(([x1, y1, x2, y2]) => doc.line(x1, y1, x2, y2));

  doc.setDrawColor(230, 235, 238);
  doc.setLineWidth(0.45);
  for (let i = 1; i < 6; i += 1) {
    doc.line(x, y + (height / 6) * i, x + width, y + (height / 6) * i);
  }
  for (let i = 1; i < 5; i += 1) {
    doc.line(x + (width / 5) * i, y, x + (width / 5) * i, y + height);
  }

  const markerX = x + width * 0.57;
  const markerY = y + height * 0.48;
  doc.setFillColor(...TOKKO_RED);
  doc.circle(markerX, markerY, 3.2, 'F');
  doc.triangle(markerX - 2.1, markerY + 1.6, markerX + 2.1, markerY + 1.6, markerX, markerY + 6.2, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(markerX, markerY, 1.1, 'F');

  const label = cleanText(address);
  if (label) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x + 3, y + height - 11, width - 6, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(label, width - 10).slice(0, 2);
    doc.text(lines, x + 5, y + height - 7.3);
  }
}

function drawFooterNote(doc, x, y, width) {
  doc.setDrawColor(...LIGHT_LINE);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + width, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.6);
  doc.setTextColor(70, 70, 70);
  const note = 'Nota importante: toda la información y medidas provistas son aproximadas y deberán ratificarse con la documentación pertinente y no compromete contractualmente a nuestra empresa. Los gastos expresados refieren a la última información recabada y deberán confirmarse. Fotografías no vinculantes ni contractuales.';
  doc.text(doc.splitTextToSize(note, width), x, y + 5);
}

function drawTopLogo(doc, logoData) {
  const logoX = PAGE_WIDTH - MARGIN - 38;
  const logoY = 6.2;

  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', logoX, logoY, 38, 15.5, undefined, 'FAST');
      return;
    } catch {
      // fallback below
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...BRAND_ORANGE);
  doc.text('are', PAGE_WIDTH - MARGIN, logoY + 11, { align: 'right' });
}

function drawBrandFooter(doc, _logoData, data) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  doc.setTextColor(...MUTED);
  doc.text(cleanText(data.website || 'are.mx'), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 4, { align: 'right' });
}


function addTextPage(doc, title, lines, data, logoData, pageIndex) {
  doc.addPage('a4', 'landscape');
  drawTopLogo(doc, logoData);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`${cleanText(data.reference)} | ${cleanText(data.propertyType)}`, MARGIN, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(cleanText(data.title), PAGE_WIDTH - MARGIN * 2 - 45);
  doc.text(titleLines.slice(0, 2), MARGIN, 21);

  let y = 36;
  y = drawSectionHeading(doc, pageIndex === 1 ? `${title} (continuación)` : title, MARGIN, y, PAGE_WIDTH - MARGIN * 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...DARK);
  doc.text(lines, MARGIN, y, { lineHeightFactor: 1.25 });

  drawFooterNote(doc, MARGIN, 184, 150);
  drawBrandFooter(doc, logoData, data);
}

function drawDescriptionPages(doc, descriptionLines, data, logoData, firstPageIndex = 1) {
  const linesPerContinuationPage = 43;
  for (let offset = 0, pageIndex = firstPageIndex; offset < descriptionLines.length; offset += linesPerContinuationPage, pageIndex += 1) {
    const pageLines = descriptionLines.slice(offset, offset + linesPerContinuationPage);
    addTextPage(doc, 'Descripción', pageLines, data, logoData, pageIndex);
  }
}

export async function createPropertyPdf(data) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  });

  doc.setProperties({
    title: cleanText(data.title),
    subject: `Ficha de propiedad ${cleanText(data.reference)}`,
    author: 'are REAL ESTATE',
    creator: 'are.mx',
  });

  const photoUrls = (data.photoUrls || []).filter(Boolean).slice(0, 7);
  const photoTasks = photoUrls.map((url, index) => {
    const ratio = index === 0 ? 1.1 : 1.45;
    return fetchImageAsCoveredJpeg(url, ratio).catch(() => null);
  });
  const [photos, logoData] = await Promise.all([
    Promise.all(photoTasks),
    data.logoUrl ? fetchImageAsPng(data.logoUrl).catch(() => null) : Promise.resolve(null),
  ]);

  drawTopLogo(doc, logoData);

  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(`${cleanText(data.reference)} | ${cleanText(data.propertyType)}`, MARGIN, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  const titleLines = doc.splitTextToSize(cleanText(data.title), LEFT_WIDTH - 2).slice(0, 2);
  doc.text(titleLines, MARGIN, 21, { lineHeightFactor: 1.05 });
  const titleBottom = 21 + titleLines.length * 6.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  const locationLines = doc.splitTextToSize(cleanText(data.location), LEFT_WIDTH - 2).slice(0, 3);
  doc.text(locationLines, MARGIN, titleBottom + 1.5, { lineHeightFactor: 1.1 });

  const operation = cleanText(data.operation || 'PROPIEDAD').toUpperCase();
  const price = cleanText(data.price || 'Consultar precio');
  doc.setFillColor(...TOKKO_CYAN);
  doc.roundedRect(RIGHT_X, 10, 19, 9, 0.7, 0.7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(255, 255, 255);
  doc.text(operation, RIGHT_X + 9.5, 15.8, { align: 'center' });
  doc.setDrawColor(170, 170, 170);
  doc.setFillColor(255, 255, 255);
  const priceWidth = Math.min(42, Math.max(24, doc.getTextWidth(price) + 8));
  doc.roundedRect(RIGHT_X + 19, 10, priceWidth, 9, 0.7, 0.7, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...DARK);
  doc.text(price, RIGHT_X + 19 + priceWidth / 2, 15.8, { align: 'center' });

  const topY = 27;
  const topHeight = 57;
  const mainWidth = RIGHT_WIDTH / 2;
  if (photos[0]) {
    doc.addImage(photos[0], 'JPEG', RIGHT_X, topY, mainWidth, topHeight, undefined, 'FAST');
  } else {
    drawPlaceholder(doc, RIGHT_X, topY, mainWidth, topHeight);
  }
  drawMapPanel(doc, RIGHT_X + mainWidth, topY, RIGHT_WIDTH - mainWidth, topHeight, data.address || data.location);

  const gridY = topY + topHeight + 0.8;
  const gridHeight = 62;
  const cellWidth = RIGHT_WIDTH / 3;
  const cellHeight = gridHeight / 2;
  for (let index = 0; index < 6; index += 1) {
    const x = RIGHT_X + (index % 3) * cellWidth;
    const y = gridY + Math.floor(index / 3) * cellHeight;
    const photo = photos[index + 1];
    if (photo) {
      doc.addImage(photo, 'JPEG', x, y, cellWidth, cellHeight, undefined, 'FAST');
    } else {
      drawPlaceholder(doc, x, y, cellWidth, cellHeight, '');
    }
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.rect(x, y, cellWidth, cellHeight);
  }

  const contactY = gridY + gridHeight + 1.8;
  doc.setFillColor(...TOKKO_RED);
  doc.rect(RIGHT_X + 12, contactY, 31, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(255, 255, 255);
  doc.text('AGENTE A CARGO', RIGHT_X + 27.5, contactY + 4.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.setFontSize(6.1);
  const contactText = `${cleanText(data.contactName)}   |   ${cleanText(data.contactPhone)}   |   ${cleanText(data.contactEmail)}`;
  doc.text(contactText, RIGHT_X + 46, contactY + 4.8);

  let y = Math.max(titleBottom + 10, 46);

  if (data.propertyDetails?.some((entry) => hasValue(entry?.value))) {
    y = drawSectionHeading(doc, 'Detalles de la propiedad', MARGIN, y, LEFT_WIDTH);
    y = drawKeyValueList(doc, data.propertyDetails, MARGIN, y, LEFT_WIDTH);
  }

  if (data.general?.some((entry) => hasValue(entry?.value))) {
    y = drawSectionHeading(doc, 'Información general', MARGIN, y + 1, LEFT_WIDTH);
    y = drawValueGrid(doc, data.general, MARGIN, y, LEFT_WIDTH, 3);
  }

  if (data.surfaces?.some((entry) => hasValue(entry?.value))) {
    y = drawSectionHeading(doc, 'Superficies y medidas', MARGIN, y + 1, LEFT_WIDTH);
    y = drawValueGrid(doc, data.surfaces, MARGIN, y, LEFT_WIDTH, 3);
  }

  if (data.placeDetails?.some((entry) => hasValue(entry?.value))) {
    y = drawSectionHeading(doc, 'Descripción del lugar', MARGIN, y + 1, LEFT_WIDTH);
    y = drawKeyValueList(doc, data.placeDetails, MARGIN, y, LEFT_WIDTH);
  }

  if (data.services?.length) {
    y = drawSectionHeading(doc, 'Servicios', MARGIN, y + 1, LEFT_WIDTH);
    y = drawSimpleList(doc, data.services, MARGIN, y, LEFT_WIDTH, 3);
  }

  if (data.spaces?.length) {
    y = drawSectionHeading(doc, 'Espacios', MARGIN, y + 1, LEFT_WIDTH);
    y = drawSimpleList(doc, data.spaces, MARGIN, y, LEFT_WIDTH, 3);
  }

  if (data.features?.length) {
    y = drawSectionHeading(doc, 'Amenidades y características', MARGIN, y + 1, LEFT_WIDTH);
    y = drawSimpleList(doc, data.features, MARGIN, y, LEFT_WIDTH, 3);
  }

  const description = cleanText(data.description || 'Sin descripción disponible.');
  const descriptionLines = doc.splitTextToSize(description, LEFT_WIDTH);
  const lineHeight = 3.2;
  const footerY = 184;

  let remainingLines = descriptionLines;
  if (y < footerY - 13) {
    y = drawSectionHeading(doc, 'Descripción', MARGIN, y + 1, LEFT_WIDTH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...DARK);

    const firstPageCapacity = Math.max(0, Math.floor((footerY - y - 5) / lineHeight));
    const firstPageLines = descriptionLines.slice(0, firstPageCapacity);
    remainingLines = descriptionLines.slice(firstPageCapacity);
    if (firstPageLines.length) {
      doc.text(firstPageLines, MARGIN, y, { lineHeightFactor: 1.18 });
    }
  }

  drawFooterNote(doc, MARGIN, footerY, LEFT_WIDTH);
  drawBrandFooter(doc, logoData, data);

  if (remainingLines.length) {
    drawDescriptionPages(doc, remainingLines, data, logoData, 1);
  }

  return {
    blob: doc.output('blob'),
    filename: `ficha-${cleanFilename(data.reference || data.title)}.pdf`,
  };
}
