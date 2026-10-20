# Reporte de pruebas actualizado

## Resultado

10 pruebas aprobadas, 0 fallos.

## Pruebas unitarias

1. Hash con sal.
2. Contraseña correcta.
3. Contraseña incorrecta.
4. Política de contraseña.
5. Conversión de horarios.

## Pruebas de integración

1. Reserva sin cuenta y consulta por código y teléfono.
2. Confirmación de transferencia y publicación en QFlow.
3. Rechazo de reservas solapadas con HTTP 409.
4. Restricción del panel de barbería al dueño.
5. Alta de barbería y asignación de rol desde el panel global.

## Evidencias

- `04-reserva-sin-cuenta.png`
- `05-panel-dueno.png`
- `06-panel-plataforma.png`
- `07-qflow.png`

La revisión en navegador no produjo errores ni advertencias de consola.

## Incidencias corregidas

| Incidencia | Corrección |
|---|---|
| La reserva exigía una cuenta de cliente | Endpoint público con datos mínimos del invitado |
| Un administrador tenía alcance global | Roles separados entre dueño de barbería y dueño de plataforma |
| Se aceptaban varios métodos de pago | Transferencia como único método |
| La agenda no representaba una cola operativa | QFlow con estados confirmado, en servicio y completado |
