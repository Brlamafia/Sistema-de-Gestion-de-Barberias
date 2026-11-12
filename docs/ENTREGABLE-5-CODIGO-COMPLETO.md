# Entregable 5 - Código completo funcionando

## Identificación

- Proyecto: Sistema de Gestión de Barberías
- Repositorio: https://github.com/Brlamafia/Sistema-de-Gestion-de-Barberias
- Autor: Bryant Rainieris Romano Peña
- Rama de entrega: `main`

## Matriz de cumplimiento

| Requisito | Implementación | Evidencia |
|---|---|---|
| Proyecto compilable y ejecutable | Aplicación Node.js sin dependencias externas | `npm start` y `GET /api/health` |
| Módulos completos | Portal público, reservas, transferencias, panel del dueño, panel global y QFlow | `public/` y rutas de `src/app.js` |
| Base de datos operativa | SQLite con creación automática, claves foráneas, índices y datos de demostración | `src/db.js` y `data/barberia.db` |
| Validaciones críticas | Campos, fechas, jornadas, solapamientos, estados, roles y aislamiento por barbería | `src/app.js` y 10 pruebas automatizadas |
| Código limpio y versionado | Capas separadas, documentación y commits en GitHub | `src/`, `public/`, `tests/`, `docs/` |

## Módulos implementados

1. Portal público responsive con información, catálogo, contacto y selección de barbería.
2. Reserva sin cuenta con nombre, teléfono, servicio, barbero, fecha, hora y referencia de transferencia.
3. Consulta de disponibilidad y consulta posterior de la reserva mediante código y teléfono.
4. Panel del dueño de barbería con confirmaciones, pagos, servicios, barberos y horarios.
5. QFlow para que el barbero atienda únicamente órdenes confirmadas y asignadas.
6. Panel del dueño de plataforma para barberías, usuarios, roles, reservas y administración delegada.
7. Persistencia SQLite y sesiones internas con cookies `HttpOnly`.

## Reglas críticas implementadas

- Las reservas públicas no requieren registro ni inicio de sesión.
- Una nueva reserva comienza en `awaiting_confirmation`; su transferencia comienza en `pending`.
- Solo el dueño correspondiente puede confirmar o rechazar; al confirmar, el pago pasa a `verified`.
- QFlow solo muestra reservas `confirmed` del barbero autenticado.
- Los estados de QFlow avanzan en orden: `confirmed` -> `in_service` -> `completed`.
- La reserva se crea dentro de `BEGIN IMMEDIATE` y vuelve a comprobar solapamientos antes de insertar.
- El dueño de una barbería queda limitado a su `shop_id`; el dueño de plataforma tiene alcance global.

## Verificación de ejecución

```bash
npm start
```

Abrir `http://127.0.0.1:3000`. La respuesta de salud esperada en `/api/health` es:

```json
{"ok":true,"database":"connected","mode":"multi-shop"}
```

## Verificación automática

```bash
npm test
```

Resultado de entrega: 10 pruebas ejecutadas, 10 aprobadas y 0 fallidas.

## Límites explícitos

La transferencia se verifica manualmente porque no existe una API bancaria suministrada. La carga de comprobantes, notificaciones externas, despliegue público y recuperación de contraseña quedan identificados como mejoras opcionales, no como requisitos obligatorios inventados.
