const express = require('express');
const { Readable } = require('stream');

// Helper to create generator over report entries
function createEntryGenerator(app, { start, end, cabecera } = {}) {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const cabeceraId = cabecera ? Number(cabecera) : null;
  const { routes, stops, orders } = app.locals;

  return function* () {
    for (const route of routes) {
      const routeStops = stops.filter(s => s.rutaId === route.id);
      const stopCount = routeStops.length;
      for (const stop of routeStops) {
        const order = orders.find(o => o.id === stop.ordenId);
        if (cabeceraId && (!order || order.sucursalId !== cabeceraId)) continue;
        if (startDate || endDate) {
          const fecha = order && order.fecha ? new Date(order.fecha) : null;
          if (startDate && (!fecha || fecha < startDate)) continue;
          if (endDate && (!fecha || fecha > endDate)) continue;
        }
        const km = Number(stop.distanciaKm) || 0;
        const min = Number(stop.tiempoMin) || 0;
        const costo = km * 1 + min * 0.5;
        const centroCosto = order ? `CC${order.sucursalId}` : 'N/A';
        const tipoServicio = order && order.tipo ? order.tipo : 'N/A';
        const costoUnitario = km ? costo / km : 0;
        yield {
          km,
          paradas: stopCount,
          tipoServicio,
          costoUnitario,
          costoTotal: costo,
          centroCosto
        };
      }
    }
  };
}

function collectMetrics(genFactory) {
  const totalsByCentro = new Map();
  let totalCost = 0;
  let totalKm = 0;
  for (const entry of genFactory()) {
    totalCost += entry.costoTotal;
    totalKm += entry.km;
    totalsByCentro.set(
      entry.centroCosto,
      (totalsByCentro.get(entry.centroCosto) || 0) + entry.costoTotal
    );
  }
  return { totalCost, totalKm, totalsByCentro };
}

const router = express.Router();

// CSV export
router.get('/csv', (req, res) => {
  const genFactory = createEntryGenerator(req.app, req.query);
  const { totalCost, totalsByCentro } = collectMetrics(genFactory);
  const engineCost = req.app.locals.calcMetrics().costo;
  if (Math.abs(totalCost - engineCost) > 1e-6) {
    return res.status(400).json({ error: 'Total mismatch with optimization engine' });
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
  const stream = Readable.from((function* () {
    yield 'km,paradas,tipoServicio,costoUnitario,costoTotal,centroCosto\n';
    for (const e of genFactory()) {
      yield `${e.km},${e.paradas},${e.tipoServicio},${e.costoUnitario},${e.costoTotal},${e.centroCosto}\n`;
    }
    yield '\nCentro de Costo,Total\n';
    for (const [cc, t] of totalsByCentro.entries()) {
      yield `${cc},${t}\n`;
    }
  })());
  stream.pipe(res);
});

// PDF summary
router.get('/pdf', (req, res) => {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch (e) {
    PDFDocument = null;
  }
  const genFactory = createEntryGenerator(req.app, req.query);
  const { totalCost, totalKm, totalsByCentro } = collectMetrics(genFactory);
  const engineCost = req.app.locals.calcMetrics().costo;
  if (Math.abs(totalCost - engineCost) > 1e-6) {
    return res.status(400).json({ error: 'Total mismatch with optimization engine' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
  if (PDFDocument) {
    const doc = new PDFDocument();
    doc.pipe(res);
    doc.fontSize(16).text('Resumen de Reporte', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Total KM: ${totalKm}`);
    doc.text(`Total costo: ${totalCost.toFixed(2)}`);
    doc.moveDown();
    doc.text('Totales por centro de costo:');
    for (const [cc, t] of totalsByCentro.entries()) {
      doc.text(`- ${cc}: ${t.toFixed(2)}`);
    }
    doc.end();
  } else {
    const lines = [
      '%PDF-1.1',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R>>endobj',
      '4 0 obj<</Length 44>>stream',
      'BT /F1 12 Tf 50 150 Td (Reporte no disponible) Tj ET',
      'endstream endobj',
      'xref 0 5',
      '0000000000 65535 f ',
      '0000000010 00000 n ',
      '0000000060 00000 n ',
      '0000000111 00000 n ',
      '0000000172 00000 n ',
      'trailer<</Size 5/Root 1 0 R>>',
      'startxref',
      '230',
      '%%EOF'
    ];
    res.send(lines.join('\n'));
  }
});

module.exports = router;
