const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from /public
app.use(express.static(path.join(__dirname, 'public')));

// Main HTML entry
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Example API route
app.get('/sucursales', (req, res) => {
  const sucursales = [
    { id: 1, nombre: 'Sucursal Centro', direccion: 'Av. Principal 123' },
    { id: 2, nombre: 'Sucursal Norte', direccion: 'Calle Secundaria 456' }
  ];
  res.json(sucursales);
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
