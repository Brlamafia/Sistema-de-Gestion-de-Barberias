# Análisis de requisitos del SRS V1

## Roles

- **Cliente:** consulta servicios, disponibilidad, agenda, cancela o reprograma citas, revisa su historial y registra pagos.
- **Administrador:** gestiona servicios, precios, barberos, horarios y citas; consulta clientes y pagos.
- **Barbero:** consulta su agenda de trabajo y las citas asignadas.

## Reglas de negocio extraídas

1. La disponibilidad depende de los horarios configurados por la barbería.
2. No se permite una reserva simultánea para el mismo barbero y horario.
3. Cada cita relaciona un cliente, un barbero, un servicio, una fecha y una hora.
4. El pago mantiene un estado asociado a la cita.
5. Las funciones administrativas requieren autorización.
6. Las contraseñas no se almacenan en texto plano.
7. Los datos se validan antes de persistirlos.
8. Los pagos en línea reales requieren un proveedor externo.

## Entidades necesarias

Usuario, Barbero, Servicio, Horario, Cita, Pago y Sesión.

## Supuestos de implementación

- Se adoptan intervalos base de 30 minutos para presentar los horarios. Es un parámetro técnico, no una regla añadida al negocio.
- La duración pertenece al servicio y puede abarcar varios intervalos.
- Una cita cancelada libera el horario.
- La reserva se bloquea si cualquier parte de su intervalo se solapa con otra cita activa del mismo barbero.
- La información comercial incluida es demostrativa porque el SRS no proporciona nombre, dirección, teléfono ni catálogo concretos.

## Mejoras opcionales no obligatorias

- Notificaciones por correo o WhatsApp.
- Pasarela de pago real.
- Recordatorios automáticos.
- Reseñas, promociones e inventario.
- Varias sucursales.
