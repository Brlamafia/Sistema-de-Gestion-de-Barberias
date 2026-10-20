# Análisis de requisitos actualizado

## Fuentes de requisitos

El SRS V1 permanece como línea base. La solicitud de cambio aprobada en octubre de 2026 modifica el registro de clientes, los roles administrativos, el modelo de múltiples barberías y el proceso de pago y confirmación.

## Roles vigentes

- Cliente invitado, sin cuenta.
- Dueño de barbería, único administrador de su negocio.
- Barbero, operador de la cola QFlow.
- Dueño de plataforma, administrador global de barberías, usuarios y roles.

## Requisitos modificados y agregados

- RF-C01: reservar sin registro, usando nombre y teléfono.
- RF-C02: seleccionar barbería, servicio, barbero, fecha y hora.
- RF-C03: registrar exclusivamente una referencia de transferencia.
- RF-C04: mantener la reserva pendiente hasta que el dueño valide la transferencia.
- RF-C05: mostrar las reservas confirmadas en QFlow.
- RF-C06: permitir al barbero iniciar y completar una orden en QFlow.
- RF-C07: restringir el panel de cada barbería a su dueño.
- RF-C08: administrar barberías, usuarios y roles desde un panel global.
- RF-C09: permitir al dueño de plataforma administrar cualquier barbería.

## Reglas de negocio

1. El cliente no inicia sesión ni crea una cuenta.
2. Nombre, teléfono y referencia de transferencia son obligatorios.
3. Una reserva nueva queda `awaiting_confirmation` y su transferencia `pending`.
4. Solo el dueño de la barbería puede confirmar o rechazar la reserva.
5. Confirmar valida la transferencia y publica la reserva en QFlow.
6. El barbero solo ve las citas confirmadas que le fueron asignadas.
7. QFlow avanza de `confirmed` a `in_service` y luego a `completed`.
8. No se permiten intervalos solapados para el mismo barbero.
9. Los datos de una barbería se filtran por `shop_id`.
10. El dueño de plataforma puede administrar todas las barberías.

## Supuestos explícitos

- QFlow se implementa como una cola web disponible en el equipo o pantalla de la barbería.
- La validación bancaria es manual porque no se proporcionó una API bancaria.
- La referencia de transferencia funciona como evidencia textual. Adjuntar comprobantes es una mejora opcional.

## Mejoras opcionales

- Notificaciones por WhatsApp o correo.
- Carga de comprobantes.
- Integración bancaria automática.
- Recuperación de contraseña y segundo factor para dueños.
