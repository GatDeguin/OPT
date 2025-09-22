# OPT

## Pruebas manuales

- [ ] Reducir el valor de **Max. monto por camión** (por ejemplo a $50.000) en el panel de configuración y cargar una ruta con montos que superen el límite. Al ejecutar **Optimizar** debe mostrarse un mensaje de error en el cargador modal indicando que la ruta excede el máximo configurado y no se debe actualizar la distribución.
- [ ] Con el mismo límite reducido, asignar manualmente puntos hasta superar el máximo y observar el resumen de ruta: el recuadro debe destacarse en rojo y el monto pico debe mostrar un tooltip con el límite configurado.
- [ ] Restaurar un valor de **Max. monto por camión** suficiente para la ruta y confirmar que la optimización finaliza correctamente y que la alerta visual desaparece.
- [ ] Dejar la cabecera sin seleccionar, agregar varios puntos a la ruta y verificar que el resumen muestra guiones en tiempo/monto mientras se muestra un aviso pidiendo elegir cabecera; los botones **Optimizar** y **Exportar** deben permanecer deshabilitados.
- [ ] Importar un CSV de órdenes con algunas filas marcadas como **usar** pero sin coordenadas. Al cargarlo debe mostrarse un aviso y las órdenes sin lat/lng no deben aparecer en la lista ni agregarse a la ruta.
- [ ] En la vista de rutas, cargar varias paradas y presionar **Limpiar**. Cancelar el diálogo de confirmación debe mantener intacta la lista de paradas actual.
- [ ] Intentar importar un CSV de sucursales al que se le haya quitado la columna **lat**. Debe mostrarse el mensaje “Falta columna lat” y no se deben modificar los datos almacenados.
- [ ] Intentar importar un CSV de camiones sin la columna **capMonto**. Debe mostrarse el mensaje “Falta columna capMonto” y la tabla de camiones debe permanecer sin cambios.
