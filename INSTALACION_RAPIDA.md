# 🚀 Instalación Rápida — Control de Canastas v2.0

## 📋 Pasos para activar el nuevo sistema

### 1️⃣ Ejecutar scripts SQL en Supabase

Ir a **Supabase SQL Editor** y ejecutar en orden:

```sql
-- 1. Migración principal (crea tablas nuevas)
-- Ejecutar: canastas_viajes_migration.sql
```

```sql
-- 2. Insertar conductores (opcional pero recomendado)
-- Ejecutar: insert_conductores.sql
```

### 2️⃣ Verificar archivos desplegados

Asegurarse que estos archivos estén en Vercel o el servidor:

**JavaScript (orden de carga importante):**
- `js/db.js` → Módulo viejo (mantiene compatibilidad)
- `js/db-viajes.js` → Nuevo módulo de viajes ✨
- `js/auth.js`
- `js/firma.js`
- `js/ui.js` → Simplificado (solo auxiliares + drawer)
- `js/ui-viajes.js` → Renderizado completo viajes ✨
- `js/app.js` → Controlador rediseñado ✨

**HTML/CSS/Otros:**
- `index.html` → Nueva estructura ✨
- `css/style.css` → Estilos actualizados ✨
- `sw.js` → Service worker actualizado
- `manifest.json` → Actualizado

### 3️⃣ Desplegar

```bash
# Si usas Git
git add .
git commit -m "feat: Control de Canastas v2.0 - Modelo de Viajes"
git push

# Vercel despliega automáticamente
```

### 4️⃣ Probar

1. Abrir la app
2. Login con `admin1` / `admin123`
3. Ir a **Dashboard** → Ver KPIs por tipo
4. Ir a **Viajes** → Clic "+ Nuevo despacho"
5. Llenar formulario y guardar
6. Ir a **Registrar Retorno** → Ver el viaje pendiente
7. Registrar retorno → Ver diferencia calculada

---

## ✅ Checklist de verificación

- [ ] Tablas `conductores`, `viajes`, `inventario_inicial` creadas en Supabase
- [ ] Conductores insertados
- [ ] Archivos JS nuevos (`db-viajes.js`, `ui-viajes.js`) en servidor
- [ ] `index.html` actualizado con nueva estructura
- [ ] CSS con estilos nuevos (KPI, tabla multi-header, drawer)
- [ ] Service Worker actualizado (v2.0.0)
- [ ] App desplegada y accesible
- [ ] Login funciona
- [ ] Dashboard muestra KPIs por tipo
- [ ] Puedo registrar un despacho
- [ ] Puedo registrar un retorno
- [ ] Tabla de viajes se ve tipo Excel

---

## 🆘 Troubleshooting

**Error: "conductores" table does not exist**
→ Ejecutar `canastas_viajes_migration.sql` en Supabase

**Error: "viaje_counter" column does not exist**
→ El script de migración actualiza `config`, verificar que se ejecutó completo

**Dashboard no muestra KPIs**
→ Abrir consola del navegador (F12) y verificar errores en `db-viajes.js`

**Tabla de viajes aparece vacía**
→ Normal si es la primera vez, registrar un viaje nuevo

**Auxiliares no aparecen**
→ Ya están cargados del modelo viejo, seguirán funcionando

**Service Worker cacheando archivos viejos**
→ Ctrl+Shift+R (hard refresh) o borrar cache del navegador

---

## 📊 Diferencias clave con v1.0

| Característica | v1.0 | v2.0 |
|---|---|---|
| **Modelo** | Movimientos simples | Viajes completos |
| **Tipos de envase** | 1 (canastas) | 4 (G/M/P/E) |
| **Responsables** | Solo auxiliar | Conductor + Auxiliar |
| **Trazabilidad** | Referencia | Placa + Remolque + Factura |
| **Estado** | No existe | Abierto / Cerrado |
| **Diferencia** | Manual | Automática |
| **Dashboard** | Total general | KPI por tipo |
| **Tabla** | Lista simple | Excel completo |

---

## 🎯 Siguientes pasos recomendados

1. **Datos**: Cargar conductores reales con cédulas correctas
2. **Dashboard**: Agregar gráficos de tendencia por semana
3. **Alertas**: Notificar viajes > 3 días sin retorno
4. **Permisos**: Roles (admin / solo lectura)
5. **Firma conductor**: Al igual que firma de auxiliar en retorno
6. **Export mejorado**: PDF con tabla formateada
7. **Móvil**: Optimizar tabla para scroll horizontal

---

**Autor**: Kiro  
**Versión**: 2.0  
**Fecha**: 2026-07-22
