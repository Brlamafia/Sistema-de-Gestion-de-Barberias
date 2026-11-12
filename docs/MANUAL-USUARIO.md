# Manual de usuario

## 1. Perfiles de uso

- Cliente invitado: consulta servicios y reserva sin crear una cuenta.
- Dueño de barbería: confirma transferencias y administra su negocio.
- Barbero: atiende las reservas confirmadas desde QFlow.
- Dueño de plataforma: administra barberías, usuarios, roles y el alcance global.

## 2. Cliente invitado - explorar y reservar

1. Abra `http://127.0.0.1:3000`.
2. Revise la portada, la información de la barbería, servicios, precios y contacto.
3. En **Reserva sin cuenta**, seleccione barbería, servicio, barbero y fecha.
4. Elija uno de los horarios disponibles. Los intervalos ocupados no aparecen.
5. Lea los datos bancarios mostrados y realice la transferencia fuera del sistema.
6. Escriba nombre, teléfono, correo opcional y referencia de transferencia.
7. Pulse **Solicitar reserva**.
8. Conserve el código `BC-00000` que muestra el sistema.

La solicitud queda pendiente hasta que el dueño verifique la transferencia. Si otro cliente toma el horario antes de finalizar, el sistema informa el conflicto y actualiza la disponibilidad.

## 3. Consultar una reserva

1. Vaya a **Consultar reserva**.
2. Escriba el código recibido y el mismo teléfono usado en la solicitud.
3. Pulse **Consultar**.
4. Revise servicio, barbero, fecha, hora, estado de la cita y estado del pago.

Estados principales: pendiente de confirmación, confirmada, en servicio, completada, rechazada o cancelada.

## 4. Dueño de barbería - acceso y confirmación

1. Pulse **Acceso interno**.
2. Inicie sesión con la cuenta de dueño.
3. El panel muestra reservas, pendientes, órdenes en QFlow y transferencias verificadas.
4. En **Confirmaciones**, revise cliente, servicio, barbero, fecha y referencia.
5. Pulse **Confirmar** si la transferencia fue validada. La reserva pasa a QFlow.
6. Pulse **Rechazar** si la transferencia no corresponde. El horario vuelve a quedar disponible.

Solo el dueño de la barbería y el dueño de plataforma pueden abrir este panel. Un barbero recibe acceso denegado.

## 5. Dueño de barbería - catálogo y horarios

- **Servicios:** indique nombre, descripción, precio y duración; pulse **Agregar**.
- **Barberos y horarios:** cree el perfil del barbero y configure día, hora inicial y hora final.
- **Transferencias:** consulte referencia, monto, estado y fecha de cada pago.

Los precios se introducen en pesos dominicanos y las duraciones deben estar entre 15 y 240 minutos.

## 6. Barbero - QFlow

1. Acceda con la cuenta de barbero desde **Acceso interno**.
2. Revise la cola de clientes confirmados que le fueron asignados.
3. Pulse **Iniciar servicio** cuando comience la atención.
4. Pulse **Completar** al terminar.

QFlow no muestra reservas pendientes ni las asignadas a otros barberos. Los estados deben avanzar en el orden indicado.

## 7. Dueño de plataforma - administración global

1. Inicie sesión con la cuenta de dueño de plataforma.
2. En **Barberías**, agregue nombre, dirección, teléfono y datos de transferencia.
3. Active o inactive barberías y use **Administrar** para entrar a la gestión completa de una de ellas.
4. En **Roles y usuarios**, cree dueños, barberos u otros administradores globales y asigne la barbería cuando corresponda.
5. En **Todas las reservas**, supervise la operación multi-barbería.

Al crear un barbero, puede indicar su especialidad; el sistema crea el perfil asociado necesario para QFlow.

## 8. Mensajes frecuentes

| Mensaje | Qué hacer |
|---|---|
| No quedan horarios disponibles | Seleccione otra fecha, servicio o barbero |
| Ese horario acaba de ser reservado | Actualice la selección y elija otro intervalo |
| Correo o contraseña incorrectos | Revise las credenciales internas |
| No tienes permisos | Inicie sesión con el rol adecuado |
| La reserva ya fue procesada | Actualice el panel; otro operador ya actuó |
| No encontramos una reserva | Confirme código y teléfono exactos |

## 9. Ejemplos completos

### Reserva y confirmación

Ana selecciona Corte clásico con Mateo, elige las 09:00, transfiere RD$800 y registra la referencia. Recibe un código. El dueño valida la transferencia y confirma; la cita aparece en QFlow de Mateo.

### Atención en QFlow

Mateo abre QFlow, inicia la cita confirmada y, al terminar el corte, la marca como completada. La consulta pública de Ana refleja el nuevo estado.

### Alta de una barbería

El dueño de plataforma crea Barbería Norte con su cuenta bancaria, crea a su dueña con el rol `shop_owner` y entra mediante **Administrar** para cargar servicios, barberos y horarios.

## 10. Buenas prácticas

- El cliente debe conservar código y teléfono.
- El dueño debe comprobar la transferencia antes de confirmar.
- Cada empleado debe usar su propia cuenta.
- Cierre la sesión al terminar en equipos compartidos.
- No publique las credenciales de demostración en un entorno real.
