# Barbería Central

Aplicación web completa para gestionar servicios, disponibilidad, citas y pagos de una barbería. La implementación parte del **SRS V1 - Sistema de Gestión de Barbería** y cubre los requisitos RF-01 a RF-15.

## Arquitectura

Se usa un monolito modular en capas con Node.js 24 y SQLite. La elección mantiene el proyecto sencillo para fines académicos, evita infraestructura externa y permite aplicar una transacción `BEGIN IMMEDIATE` al reservar o reprogramar. Esto impide que dos solicitudes concurrentes asignen al mismo barbero en intervalos solapados.

```text
Navegador responsive
        │ HTTP + JSON
Servidor Node.js
  ├─ autenticación y autorización
  ├─ servicios y barberos
  ├─ disponibilidad y citas
  ├─ pagos
  └─ administración
        │ SQL transaccional
      SQLite
```

No se usan paquetes externos. El servidor HTTP, el cifrado `scrypt`, las pruebas y SQLite forman parte de Node.js 24.

## Funcionalidades

- Registro, inicio y cierre de sesión.
- Contraseñas almacenadas con `scrypt`, sal aleatoria y comparación segura.
- Catálogo activo de servicios con precio y duración.
- Disponibilidad por barbero y fecha.
- Reserva, historial, cancelación y reprogramación de citas.
- Prevención de reservas solapadas dentro de una transacción.
- Registro de pagos en efectivo, transferencia o tarjeta demostrativa.
- Agenda del barbero.
- Panel administrativo para servicios, barberos, horarios, citas, clientes y pagos.
- Interfaz adaptable a móvil y escritorio.

## Requisitos

- Node.js 24 o superior.

## Ejecución

```bash
npm start
```

Abre `http://127.0.0.1:3000`. La base se crea automáticamente en `data/barberia.db` con datos demostrativos.

### Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Cliente | cliente@cortecentral.do | Cliente123! |
| Administrador | admin@cortecentral.do | Admin123! |
| Barbero | barbero@cortecentral.do | Barber123! |

Estas credenciales son solo para demostración y deben cambiarse antes de un despliegue real.

## Pruebas

```bash
npm test
```

Las pruebas cubren seguridad de contraseñas, validación de política, conversión de horarios, flujo de registro-reserva-pago, rechazo de citas solapadas y control de acceso al panel administrativo.

## Estructura

```text
barberia-central/
├─ public/              interfaz web responsive
├─ src/                 servidor, rutas, seguridad y persistencia
├─ tests/               pruebas unitarias e integración
├─ data/                base SQLite local generada al iniciar
├─ docs/                análisis, diseño y reporte de pruebas
└─ README.md
```

## Supuestos y límites

- La marca, dirección y teléfonos son datos demostrativos porque el SRS no define una identidad comercial concreta.
- Los horarios avanzan en bloques de 30 minutos; la duración de cada servicio determina cuántos bloques ocupa.
- `card_demo` simula una aprobación y no procesa dinero real. El SRS declara que los pagos en línea dependen de un proveedor externo.
- Nómina, contabilidad e inventario avanzado quedan fuera del alcance, tal como indica el SRS.

## Despliegue recomendado

Para producción se recomienda ejecutar detrás de HTTPS, definir copias de seguridad de SQLite o migrar a PostgreSQL si aumenta la concurrencia, reemplazar las cuentas demo y conectar un proveedor de pagos aprobado. El código actual funciona localmente sin configuración adicional.
