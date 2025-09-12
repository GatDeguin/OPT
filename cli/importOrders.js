#!/usr/bin/env node
const fs = require('fs');
const http = require('http');

const file = process.argv[2];
const user = process.argv[3] || 'cli';
if (!file) {
  console.error('Uso: node cli/importOrders.js <archivo.csv> [usuario]');
  process.exit(1);
}

const stat = fs.statSync(file);
const total = stat.size;
let sent = 0;

const req = http.request({
  method: 'POST',
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/ordenes/import',
  headers: {
    'Content-Type': 'text/csv',
    'x-user': user
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    process.stdout.write('\n');
    console.log('Reporte:', data.toString());
  });
});

const stream = fs.createReadStream(file);
stream.on('data', chunk => {
  sent += chunk.length;
  const pct = ((sent / total) * 100).toFixed(2);
  process.stdout.write(`\rEnviado ${pct}%`);
});
stream.pipe(req);
