const atms = [
  { codigo: '50007', nombre: 'América', lat: -35.426, lng: -61.306 },
  { codigo: '50009', nombre: 'Ayacucho', lat: -37.149, lng: -57.139 },
  { codigo: '50010', nombre: 'Bahía Blanca', lat: -38.715, lng: -62.268 },
  { codigo: '50012', nombre: 'Bragado', lat: -35.119, lng: -60.494 }
];

const sucursales = [
  { codigo: '10001', nombre: 'Bahía Blanca - Centro', lat: -38.718, lng: -62.268, cochera: false },
  { codigo: '10002', nombre: 'La Plata - Catedral', lat: -34.921, lng: -57.954, cochera: true },
  { codigo: '10003', nombre: 'Mar del Plata', lat: -38.002, lng: -57.556, cochera: false }
];

const cabeceras = [
  { codigo: '0106', nombre: 'Quilmes', direccion: 'Av. Calchaquí', localidad: 'Quilmes', supervisor: 'M. Ruiz', telefono: '11-23456', lat: -34.7206, lng: -58.2546 },
  { codigo: '0101', nombre: 'La Plata', direccion: 'Av. 7 925', localidad: 'La Plata', supervisor: 'J. Pérez', telefono: '11-12348', lat: -34.9214, lng: -57.9545 }
];

const otrosBancos = [
  { codigo: 'BCRA01', nombre: 'BCRA', lat: -34.6037, lng: -58.3816, direccion: 'Reconquista 266' },
  { codigo: 'OTRO01', nombre: 'Otro Banco X', lat: -34.6, lng: -58.44, direccion: 'Av. Siempre Viva 123' }
];

const choferes = [
  { legajo: 'C001', nombre: 'Juan Pérez', licencia: 'C1', vto: '2026-06-30', tel: '11-1234-5678' },
  { legajo: 'C002', nombre: 'María López', licencia: 'C2', vto: '2025-11-15', tel: '11-2345-6789' }
];

const camiones = [
  { id: 'TRK101', modelo: 'Iveco Daily', capMonto: 200000000, capKg: 1500, velMax: 60 },
  { id: 'TRK102', modelo: 'Mercedes Sprinter', capMonto: 250000000, capKg: 1700, velMax: 65 }
];

const ordenes = [
  { id: 'ORD-001', fecha: '2025-08-22', categoria: 'ATM', codigo: '50010', nombre: 'Bahía Blanca', lat: -38.715, lng: -62.268, monto: -30000000, moneda: 'ARS', denominacion: '$1000', servicio: 'Abastecimiento', peso: 20, usar: false },
  { id: 'ORD-002', fecha: '2025-08-22', categoria: 'Sucursal', codigo: '10003', nombre: 'Mar del Plata', lat: -38.002, lng: -57.556, monto: 45000000, moneda: 'ARS', denominacion: 'Mixta', servicio: 'Retiro', peso: 30, usar: false }
];

module.exports = {
  atms,
  sucursales,
  cabeceras,
  otrosBancos,
  choferes,
  camiones,
  ordenes
};
