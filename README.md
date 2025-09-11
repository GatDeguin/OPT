# OptiRutas

Aplicación web estática para Banco Provincia. El código se modularizó
separando estilos y scripts en carpetas dedicadas para facilitar el
mantenimiento y el despliegue en **GitHub Pages**.

## Estructura

- `index.html`: punto de entrada de la app.
- `css/styles.css`: estilos globales.
- `js/app.js`: lógica de la aplicación.

## Uso local

Abra `index.html` directamente en el navegador o sirva la carpeta con
un servidor simple, por ejemplo:

```bash
npx serve .
```

## Despliegue

Suba los archivos al branch configurado de GitHub Pages (por defecto
`main`). GitHub publicará automáticamente el contenido estático.

