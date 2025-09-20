# OPT

## Pruebas manuales

- [ ] Reducir el valor de **Max. monto por camión** (por ejemplo a $50.000) en el panel de configuración y cargar una ruta con montos que superen el límite. Al ejecutar **Optimizar** debe mostrarse un mensaje de error en el cargador modal indicando que la ruta excede el máximo configurado y no se debe actualizar la distribución.
- [ ] Con el mismo límite reducido, asignar manualmente puntos hasta superar el máximo y observar el resumen de ruta: el recuadro debe destacarse en rojo y el monto pico debe mostrar un tooltip con el límite configurado.
- [ ] Restaurar un valor de **Max. monto por camión** suficiente para la ruta y confirmar que la optimización finaliza correctamente y que la alerta visual desaparece.
- [ ] Dejar la cabecera sin seleccionar, agregar varios puntos a la ruta y verificar que el resumen muestra guiones en tiempo/monto mientras se muestra un aviso pidiendo elegir cabecera; los botones **Optimizar** y **Exportar** deben permanecer deshabilitados.
