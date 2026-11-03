# Entregable 4 - Reporte de pruebas

Fecha de ejecución: 2 de noviembre de 2026.

## 1. Resumen ejecutivo

La versión evaluada corresponde a la rama `main` del repositorio `Brlamafia/Sistema-de-Gestion-de-Barberias`. La suite automatizada contiene cinco pruebas unitarias y cinco pruebas de integración. El resultado final fue de 10 pruebas aprobadas, 0 fallos, 0 canceladas y 0 omitidas.

## 2. Estrategia y alcance

- Pruebas unitarias sobre seguridad y utilidades de horario.
- Pruebas de integración sobre API, persistencia SQLite, roles y procesos completos.
- Validación manual de las interfaces de reserva, panel del dueño, administración global y QFlow.
- Base SQLite en memoria para aislar cada ejecución automatizada.
- Navegador de escritorio y vista móvil para la revisión visual.

## 3. Plan de pruebas

| ID | Tipo | Caso | Resultado esperado |
|---|---|---|---|
| PU-01 | Unitaria | Almacenar contraseña | Hash con sal, nunca texto plano |
| PU-02 | Unitaria | Verificar contraseña correcta | Resultado verdadero |
| PU-03 | Unitaria | Rechazar contraseña incorrecta | Resultado falso |
| PU-04 | Unitaria | Aplicar política de contraseña | Acepta solo formato válido |
| PU-05 | Unitaria | Convertir hora a minutos y viceversa | Conversión sin pérdida |
| PI-01 | Integración | Reserva anónima y consulta | Cita pendiente y pago pendiente |
| PI-02 | Integración | Confirmación y atención en QFlow | confirmed, in_service y completed |
| PI-03 | Integración | Reservas solapadas | Segunda solicitud rechazada con 409 |
| PI-04 | Integración | Acceso al panel del dueño | Dueño 200, barbero 403 |
| PI-05 | Integración | Administración global | Alta de barbería y rol persistida |
| PM-01 | Manual | Formulario de reserva | Campos legibles, horarios y referencia |
| PM-02 | Manual | Panel del dueño | Métricas, transferencias y acciones |
| PM-03 | Manual | Panel de plataforma | Barberías, usuarios y roles |
| PM-04 | Manual | Cola QFlow | Solo citas confirmadas del barbero |
| PM-05 | Manual | Diseño adaptable | Uso correcto en escritorio y móvil |

## 4. Pruebas unitarias implementadas

Las cinco pruebas se encuentran en `tests/security.test.js` y usan `node:test` con aserciones estrictas. Todas aprobaron.

## 5. Pruebas de integración

Las cinco pruebas se encuentran en `tests/api.test.js`. Levantan el servidor en un puerto disponible, crean SQLite en memoria y consumen la API mediante HTTP.

### Flujo PI-01

1. Consultar disponibilidad.
2. Crear una reserva sin cuenta.
3. Verificar estado `awaiting_confirmation`.
4. Consultar con código y teléfono.
5. Verificar pago `pending`.

### Flujo PI-02

1. Autenticar al dueño.
2. Confirmar la transferencia.
3. Autenticar al barbero.
4. Verificar aparición en QFlow.
5. Cambiar a `in_service` y luego `completed`.

## 6. Registro de incidencias

| ID | Incidencia | Severidad | Corrección | Estado |
|---|---|---|---|---|
| INC-01 | La reserva exigía una cuenta de cliente | Alta | Reserva pública con datos mínimos | Cerrada |
| INC-02 | Riesgo de dos reservas para el mismo horario | Crítica | Transacción `BEGIN IMMEDIATE` y respuesta 409 | Cerrada |
| INC-03 | Un administrador podía tener alcance global | Alta | Roles `shop_owner` y `platform_owner` separados | Cerrada |
| INC-04 | Se aceptaban métodos de pago fuera del alcance | Media | Transferencia como método único | Cerrada |
| INC-05 | La agenda no representaba el trabajo del barbero | Media | QFlow con estados operativos | Cerrada |
| INC-06 | El barbero podía intentar abrir el panel del dueño | Alta | Control RBAC y respuesta 403 | Cerrada |

## 7. Evidencias

- Salida automática: 10 aprobadas, 0 fallos.
- Captura del formulario de reserva sin cuenta.
- Captura del panel del dueño de barbería.
- Captura de la administración global.
- Captura de la cola QFlow.
- Evidencias móviles del inicio y de la reserva.

## 8. Ejecución

```bash
npm test
```

Resultado verificado: 10 pruebas aprobadas, 0 fallos.
