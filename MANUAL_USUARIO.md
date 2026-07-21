# 📦 Manual de Usuario — Control de Canastas

**Versión 1.0 | Aplicación web disponible en:** `canastappalpina.vercel.app`

---

## ¿Para qué sirve esta app?

Sirve para controlar cuántas canastas tenemos, dónde están y quién las tiene en todo momento. Evita pérdidas y permite saber de un vistazo el inventario real.

---

## 🔐 1. Cómo entrar

1. Abre el navegador y ve a `canastappalpina.vercel.app`
2. Escribe tu **usuario** y **contraseña**
3. Haz clic en **Iniciar Sesión**

**Usuarios disponibles:**

| Usuario | Contraseña |
|---------|------------|
| admin1  | admin123   |
| admin2  | admin456   |
| admin3  | admin789   |

> 💡 Cada administrador tiene su propio acceso. La app registra quién hizo cada movimiento.

Para salir, haz clic en el botón **Salir** arriba a la derecha.

---

## 📊 2. Dashboard (Pantalla principal)

Al entrar verás 4 tarjetas con el resumen del inventario:

| Tarjeta | Qué muestra |
|---------|-------------|
| 🟢 **En Bodega** | Canastas disponibles ahora mismo |
| 🔵 **Con Auxiliares** | Canastas que están fuera con trabajadores |
| 🟠 **Préstamos Clientes** | Canastas que un cliente nos dejó prestadas |
| ⚪ **Total Sistema** | Suma de bodega + auxiliares |

Debajo aparece:
- **Detalle por auxiliar** — cuántas canastas tiene cada uno fuera
- **Préstamos activos de clientes** — qué cliente dejó cuántas canastas
- **Últimos 10 movimientos** — historial reciente

---

## ↔️ 3. Registrar un Movimiento

Esta es la sección más importante. Aquí se registra todo lo que entra y sale.

Hay **4 tipos de movimiento:**

---

### 📤 A. Salida a Auxiliar
*Un auxiliar se lleva canastas de bodega.*

1. Ir a **Registrar Movimiento**
2. Seleccionar la pestaña **Salida a Auxiliar**
3. Elegir el auxiliar del listado
4. Escribir la cantidad de canastas que se lleva
5. Agregar una nota si quieres (opcional)
6. Clic en **Registrar Salida**

✅ El sistema descuenta las canastas de bodega y las asigna al auxiliar.

---

### 📥 B. Entrada de Auxiliar
*El auxiliar devuelve las canastas a bodega.*

1. Seleccionar la pestaña **Entrada de Auxiliar**
2. Elegir el auxiliar — el sistema muestra cuántas tiene pendientes
3. Escribir la cantidad que devuelve
4. Clic en **Registrar Entrada**

✅ Las canastas vuelven a bodega y se descuentan del auxiliar.

---

### 🏢 C. Entrada de Cliente
*Un cliente nos deja canastas prestadas.*

1. Seleccionar la pestaña **Entrada Cliente**
2. Escribir el nombre del cliente
3. Escribir la cantidad de canastas que dejó
4. Clic en **Registrar Préstamo**

✅ Las canastas entran a bodega y quedan registradas como préstamo del cliente.

---

### 🔄 D. Salida a Cliente
*Le devolvemos las canastas al cliente.*

1. Seleccionar la pestaña **Salida a Cliente**
2. Elegir el préstamo del cliente en el listado
3. Escribir la cantidad a devolver
4. Clic en **Registrar Devolución**

✅ Las canastas salen de bodega y se cierra (o reduce) el préstamo del cliente.

---

## 👷 4. Gestión de Auxiliares

Aquí se administran los trabajadores que manejan canastas.

**Para agregar un auxiliar:**
1. Ir a la sección **Auxiliares**
2. Escribir nombre completo y cédula
3. Clic en **Guardar**

**Para editar un auxiliar:**
- Clic en el botón **Editar** en la tarjeta del auxiliar

**Para desactivar un auxiliar:**
- Clic en **Desactivar** — solo funciona si el auxiliar no tiene canastas pendientes

> ⚠️ No se puede desactivar un auxiliar que tenga canastas fuera sin devolverlas primero.

---

## 📋 5. Historial

Registro completo de todos los movimientos.

**Puedes filtrar por:**
- Rango de fechas (desde / hasta)
- Tipo de movimiento
- Auxiliar específico

**Para exportar:**
- Clic en **⬇ Exportar CSV** para descargar el historial en Excel

Cada movimiento tiene un número de referencia único tipo `MOV-2025-0001`.

---

## ⚙️ 6. Configuración

**Actualizar inventario de bodega:**
- Permite ajustar manualmente la cantidad de canastas en bodega (por ejemplo al hacer un conteo físico)

**Reiniciar datos:**
- Borra todo y vuelve al estado inicial
- ⚠️ Usar solo en caso de pruebas o errores graves — no se puede deshacer

---

## 📱 Uso desde celular

La app funciona perfectamente desde el celular.

Para instalarla como app en el teléfono:
- **Android:** Abre en Chrome → menú (3 puntos) → *"Agregar a pantalla de inicio"*
- **iPhone:** Abre en Safari → botón compartir → *"Añadir a pantalla de inicio"*

Una vez instalada funciona como una app normal, incluso sin internet.

---

## ❓ Preguntas frecuentes

**¿Qué pasa si registro una cantidad equivocada?**
Actualmente no hay opción de editar movimientos. Se debe registrar un movimiento contrario para corregir el conteo. Ejemplo: si se registró salida de 10 pero eran 8, registrar entrada de 2 del mismo auxiliar.

**¿Se pierden los datos si se cierra el navegador?**
No. Los datos se guardan automáticamente en el navegador. Sin embargo, son datos locales por dispositivo — cada dispositivo tiene su propia base de datos.

**¿Puedo usar la app en varios computadores a la vez?**
Sí, pero cada dispositivo maneja su propia información. No están sincronizados entre sí.

**¿Quién puede ver los movimientos?**
Cualquiera de los 3 administradores puede ver todo el historial desde su sesión.

---

*Manual generado para uso interno — Control de Canastas v1.0*
