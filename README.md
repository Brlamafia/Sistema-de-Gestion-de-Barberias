# Sistema de Gestión de Barberías

Aplicación multi-barbería basada en el SRS V1 y ampliada mediante la solicitud de cambio de octubre de 2026. Los clientes reservan sin crear una cuenta. El personal interno utiliza acceso por roles.

## Repositorio

Código fuente e historial de commits: https://github.com/Brlamafia/Sistema-de-Gestion-de-Barberias

## Arquitectura

Monolito modular en capas con Node.js 24, servidor HTTP nativo, SQLite, HTML, CSS y JavaScript. No requiere instalar dependencias externas. La transacción `BEGIN IMMEDIATE` vuelve a verificar la disponibilidad antes de insertar una reserva y evita solapamientos.

## Roles

- **Cliente invitado:** escribe nombre y teléfono, selecciona barbería, corte, barbero, fecha y hora, e indica la referencia de transferencia.
- **Dueño de barbería:** único rol con acceso al panel administrativo de su barbería. Confirma o rechaza transferencias y reservas, y gestiona servicios, barberos y horarios.
- **Barbero:** accede únicamente a QFlow para iniciar y completar las reservas que el dueño confirmó.
- **Dueño de plataforma:** administra barberías activas, usuarios, roles y cualquier barbería desde el panel global.

## Flujo de reserva

1. El cliente reserva sin registrarse.
2. El sistema crea la reserva con estado `awaiting_confirmation` y un pago por transferencia `pending`.
3. El dueño revisa la referencia y confirma o rechaza.
4. Al confirmar, la transferencia queda `verified` y la reserva aparece en QFlow.
5. El barbero cambia el estado a `in_service` y luego `completed`.

## Ejecución

```bash
npm start
```

Abrir `http://127.0.0.1:3000`. La base se crea automáticamente en `data/barberia.db`.

## Credenciales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Dueño de plataforma | plataforma@barberia.local | Plataforma123! |
| Dueño de barbería | dueno@barberia.local | Dueno123! |
| Barbero | barbero@barberia.local | Barbero123! |

Los clientes no tienen credenciales porque no necesitan crear cuenta.

## Pruebas

```bash
npm test
```

La suite contiene 10 pruebas: cinco unitarias y cinco de integración. Cubre reserva anónima, consulta por código y teléfono, confirmación de transferencia, QFlow, bloqueo de solapamientos, separación de roles y administración multi-barbería.

## Estructura

```text
Sistema-de-Gestion-de-Barberias/
├─ public/              interfaz responsive
├─ src/                 servidor, seguridad, base de datos y reglas
├─ tests/               pruebas unitarias y de integración
├─ docs/                análisis, diseño, reporte y evidencias
└─ data/                SQLite local generado en ejecución
```

## Alcance externo

La transferencia se valida manualmente mediante su referencia. La conexión automática con bancos, comprobantes adjuntos, notificaciones y despliegue público requieren servicios externos y no se inventan como parte del SRS original.
