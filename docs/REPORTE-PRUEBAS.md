# Reporte de pruebas

## Plan de pruebas

| ID | Tipo | Caso | Resultado esperado |
| --- | --- | --- | --- |
| CP-01 | Unitaria | Generar hash de contraseña | No coincide con el texto plano |
| CP-02 | Unitaria | Verificar contraseña correcta | Acceso aceptado |
| CP-03 | Unitaria | Verificar contraseña incorrecta | Acceso rechazado |
| CP-04 | Unitaria | Validar política de contraseña | Rechaza entradas débiles |
| CP-05 | Unitaria | Convertir hora a minutos y viceversa | Conversión exacta |
| CP-06 | Integración | Registro, login, disponibilidad, reserva y pago | Flujo completo persistido |
| CP-07 | Integración | Dos clientes reservan intervalos solapados | Segunda solicitud recibe HTTP 409 |
| CP-08 | Integración | Cliente abre panel administrativo | Solicitud recibe HTTP 403 |
| CP-09 | Integración | Administrador abre panel | Resumen y datos disponibles |
| CP-10 | Manual | Diseño responsive | Navegación utilizable en móvil y escritorio |

## Pruebas automatizadas

Ejecutar `npm test`. El proyecto incluye cinco pruebas unitarias y tres pruebas de integración. El reporte de consola se conserva en `docs/evidencias/test-results.txt`.

## Registro de incidencias

| Incidencia | Detección | Corrección | Estado |
| --- | --- | --- | --- |
| Riesgo de reserva duplicada por solicitudes concurrentes | Revisión de diseño | Transacción `BEGIN IMMEDIATE` y consulta de solapamiento antes de insertar | Corregida |
| Un servicio de 60 minutos podía chocar con una cita que empezara a mitad del intervalo | Caso CP-07 | Comparación de intervalos `inicio < finExistente` y `fin > inicioExistente` | Corregida |
| Acceso administrativo desde una sesión de cliente | Caso CP-08 | Middleware de autorización por rol | Corregida |
| Pago repetido para una misma cita | Revisión de integridad | Restricción única en `payments.appointment_id` y respuesta HTTP 409 | Corregida |

## Evidencias

- Resultado automático: `docs/evidencias/test-results.txt`.
- Capturas principales: `docs/evidencias/01-inicio.png`, `02-reserva.png` y `03-panel-admin.png`.
- La ruta `/api/health` devuelve `database: connected` mientras el servidor está operativo.
