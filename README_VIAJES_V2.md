# Control de Canastas v2.0 — Modelo de Viajes

## Lo que cambió

La app pasó del modelo de "movimientos simples de canastas" al **modelo Excel completo de control de despachos**.

### Antes (v1.0)
- Movimientos independientes: salida auxiliar / entrada auxiliar / entrada cliente / salida cliente
- Una sola unidad ("canastas")
- Estado en JSON de una sola fila

### Ahora (v2.0)
- **Viajes completos**: Un viaje agrupa Despacho + Retorno + Diferencia calculada
- **4 tipos de envase**: Grandes / Medianas / Pequeñas / Estibas (igual que el Excel)
- **Conductor + Auxiliar**: Cada viaje tiene ambos
- **Placa + Remolque + # Factura**: Trazabilidad completa
- **Estado del viaje**: Abierto (esperando retorno) / Cerrado (retorno registrado)
- **Diferencia automática**: Despachado - Retornado = Diferencia (por tipo)

---

## Estructura de BD

### Nuevas tablas

**conductores**
- id, nombre, cedula (UNIQUE), activo, created_at

**viajes**
- id, numero_viaje (UNIQUE), fecha, conductor_id (FK), auxiliar_id (FK)
- placa, remolque, numero_factura
- **desp_grandes, desp_medianas, desp_pequenas, desp_estibas** (lo que salió)
- **ret_grandes, ret_medianas, ret_pequenas, ret_estibas** (lo que retornó)
- fecha_retorno, estado (abierto/cerrado/anulado)
- observaciones, admin_registrador, created_at, updated_at

**inventario_inicial**
- id='main', grandes, medianas, pequenas, estibas
- Se usa como punto de partida para calcular la diferencia acumulada

**config** (actualizada)
- Añadido: `viaje_counter` para generar números de viaje (YYYY-NNNN)

### Tablas viejas (mantienen compatibilidad)
- auxiliares, movimientos, estado, config → Siguen existiendo
- Esto permite migración gradual o usar ambos flujos si es necesario

---

## Flujo principal

### 1. Registrar Despacho (nuevo viaje)
- Seleccionas: Conductor + Auxiliar
- Ingresas: Placa, Remolque (opcional), # Factura (opcional)
- Registras cantidades: Grandes / Medianas / Pequeñas / Estibas despachadas
- Se genera: Número de viaje único (Ej: 2026-0001)
- Estado: **Abierto** (esperando retorno)

### 2. Registrar Retorno
- Lista de viajes abiertos (pendientes)
- Seleccionas el viaje
- Ingresas cantidades retornadas por tipo
- Preview en tiempo real de la diferencia
- Al confirmar: Estado pasa a **Cerrado**

### 3. Ver Tabla de Viajes
- Igual al Excel: cada fila es un viaje
- Columnas agrupadas: Despachado / Retorno / Diferencia
- Totales acumulados al inicio
- Filtros: por fecha, por estado
- Export CSV

### 4. Dashboard
- KPI cards por tipo (diferencia acumulada)
- Viajes sin retorno (alerta)
- Últimos despachos

---

## Archivos nuevos

```
canastas-app/js/
  db-viajes.js      → CRUD de conductores, viajes, inventario inicial
  ui-viajes.js      → Renderizado de dashboard, viajes, retornos
  app.js            → Controlador rediseñado con navegación + drawers

canastillas/
  canastas_viajes_migration.sql  → Script DDL completo para Supabase
  README_VIAJES_V2.md             → Este archivo
```

---

## Instalación

1. **Ejecutar el SQL de migración**:
   - Ir a Supabase SQL Editor
   - Pegar y ejecutar `canastas_viajes_migration.sql`
   - Esto crea las tablas nuevas SIN ELIMINAR las viejas

2. **Actualizar la app** (ya hecho):
   - `index.html` → nueva estructura de secciones
   - `css/style.css` → estilos nuevos (KPI, tabla multi-header, drawer)
   - scripts cargados en orden: db.js → db-viajes.js → auth → firma → ui → ui-viajes → app

3. **Desplegar**:
   - Hacer push a Vercel o donde esté desplegado
   - Listo

---

## Cómo usar

### Registrar un despacho
1. Ir a sección **"Viajes"**
2. Clic en **"+ Nuevo despacho"**
3. Llenar: Conductor, Auxiliar, Placa, cantidades despachadas
4. Guardar → se crea viaje con estado **Abierto**

### Registrar un retorno
1. Ir a sección **"Registrar Retorno"**
2. Ver lista de viajes pendientes
3. Clic en **"Registrar retorno"** del viaje correspondiente
4. Ingresar cantidades devueltas
5. Ver preview de diferencia
6. Confirmar → viaje pasa a **Cerrado**

### Ver historial
1. Ir a **"Viajes"**
2. Tabla completa tipo Excel
3. Filtrar por fecha / estado
4. Click en 👁️ para ver detalle completo
5. Export CSV para análisis

---

## Diferencia vs. modelo anterior

| Aspecto | v1.0 | v2.0 |
|---------|------|------|
| Unidad | "Canastas" | Grandes / Medianas / Pequeñas / Estibas |
| Registro | Movimiento independiente | Viaje completo (Despacho + Retorno) |
| Responsable | Auxiliar solo | Conductor + Auxiliar |
| Trazabilidad | Ref numérica | Placa + Remolque + # Factura |
| Estado | No existe | Abierto / Cerrado |
| Diferencia | Manual | Calculada automáticamente |
| UI | Modal formulario | Drawer lateral |
| Dashboard | Total canastas | KPI por tipo |
| Export | Movimientos CSV | Tabla Excel CSV |

---

## Ventajas del nuevo modelo

✅ Replica exactamente el Excel de control  
✅ Trazabilidad completa por viaje  
✅ Diferencia calculada automáticamente  
✅ Alerta de viajes sin retorno (pendientes)  
✅ Dashboard con KPI por tipo de envase  
✅ Tabla visual igual al Excel → fácil de entender  
✅ CSV exportable compatible con el Excel original  

---

## Próximos pasos sugeridos

- [ ] Agregar conductores precargados con un SQL `insert_conductores.sql`
- [ ] Dashboard con gráfico de diferencia por semana/mes
- [ ] Notificaciones cuando un viaje lleva > 3 días sin retorno
- [ ] Historial de viajes por conductor / por auxiliar (drawer lateral)
- [ ] Firma del conductor en el retorno (similar a firma de auxiliar)
- [ ] Modo "Solo lectura" para visualización sin permisos de edición
- [ ] Campo "Turno" si se necesita diferenciar mañana/tarde/noche

---

**Autor**: Kiro  
**Fecha**: 2026  
**Versión**: 2.0
