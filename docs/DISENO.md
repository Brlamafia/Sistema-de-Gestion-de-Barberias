# Diseño actualizado

## Arquitectura

Monolito modular multiinquilino. La interfaz pública, el panel de barbería, QFlow y el panel de plataforma consumen una API HTTP común. SQLite aplica claves foráneas, aislamiento por `shop_id` y transacciones para las reservas.

## Entidades

| Tabla | Propósito |
|---|---|
| shops | Barberías activas y datos de transferencia |
| staff_users | Dueños de plataforma, dueños de barbería y barberos |
| shop_barbers | Barberos pertenecientes a una barbería |
| shop_services | Catálogo por barbería |
| shop_schedules | Jornadas por barbero |
| shop_appointments | Reservas de invitados sin cuenta |
| transfer_payments | Referencia y validación de transferencia |
| staff_sessions | Sesiones internas protegidas |

## Estados

Reserva: `awaiting_confirmation`, `confirmed`, `in_service`, `completed`, `cancelled`, `rejected`.

Transferencia: `pending`, `verified`, `rejected`, `refunded`.

## Secuencias clave

### Reserva y confirmación

Cliente invitado → disponibilidad → reserva y referencia → dueño valida → transferencia verificada → reserva confirmada → QFlow.

### Atención en QFlow

Barbero inicia sesión → consulta cola asignada → inicia servicio → completa servicio.

## Control de acceso

- `/api/owner/*`: dueño de barbería para su `shop_id`; el dueño de plataforma puede indicar una barbería.
- `/api/qflow/*`: solo barbero y solo sus reservas.
- `/api/platform/*`: solo dueño de plataforma.
- Reserva, catálogo y consulta de estado: públicas.

## Consistencia

La inserción de una reserva usa `BEGIN IMMEDIATE` y la regla de intersección `inicioB < finA AND finB > inicioA`. Las reservas canceladas o rechazadas liberan el espacio.
