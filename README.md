# OptiRutas

Aplicación web estática para Banco Provincia. El código se modularizó
separando estilos y scripts en carpetas dedicadas para facilitar el
mantenimiento y el despliegue en **GitHub Pages**.

## Estructura

- `index.html`: punto de entrada de la app.
- `css/styles.css`: estilos globales.
- `js/app.js`: lógica de la aplicación.

## Uso local

Instale las dependencias y levante el servidor Express:

```bash
npm install
npm start
```

El servidor sirve los archivos estáticos y expone una API en `http://localhost:3000`.

Ejemplo de consumo desde el frontend:

```js
fetch('/sucursales')
  .then(r => r.json())
  .then(data => console.log(data));
```

## Tests

Ejecuta las pruebas con:

```bash
npm test
```

## Despliegue

Cada commit en `main` ejecuta un workflow de GitHub Actions que:

1. Instala dependencias y ejecuta los tests.
2. Genera la carpeta `dist/` mediante `npm run build`.
3. Publica ese contenido en la rama `gh-pages`.

Configure GitHub Pages para tomar los archivos desde `gh-pages` y el sitio
se actualizará automáticamente tras cada push a `main`.
