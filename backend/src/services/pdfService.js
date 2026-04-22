import PDFDocument from 'pdfkit';

export function generateServicePdf(service) {
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  doc.fontSize(22).text('Service Detail', { underline: true });
  doc.moveDown();
  doc.fontSize(16).text(`Name: ${service.name}`);
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Description: ${service.description || 'N/A'}`);
  doc.moveDown(0.5);
  doc.text(`Price: $${service.price || 0}`);
  doc.moveDown(0.5);
  doc.text(`Created At: ${new Date(service.created_at).toLocaleString()}`);

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}
