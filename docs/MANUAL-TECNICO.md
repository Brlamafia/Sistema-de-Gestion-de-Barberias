# Manual técnico

## 1. Propósito y alcance

Este manual permite instalar, configurar, ejecutar, probar y mantener el Sistema de Gestión de Barberías. El sistema es una aplicación web multi-barbería para reservas sin cuenta, pagos por transferencia, administración por roles y operación de QFlow.

## 2. Requisitos del entorno

- Windows, macOS o Linux.
- Node.js 24 o superior.
- Navegador moderno.
- Puerto TCP 3000 disponible, salvo que se configure otro.
- Git es opcional para clonar y consultar el historial.

No se requieren paquetes de terceros: el proyecto utiliza módulos nativos de Node.js, incluido `node:sqlite`.

## 3. Instalación

### Desde GitHub

```bash
git clone https://github.com/Brlamafia/Sistema-de-Gestion-de-Barberias.git
cd Sistema-de-Gestion-de-Barberias
npm start
```

### Desde el archivo ZIP

1. Extraer el ZIP en una carpeta con permisos de escritura.
2. Abrir una terminal dentro de la carpeta extraída.
3. Ejecutar `npm start`.
4. Abrir `http://127.0.0.1:3000`.

No es necesario ejecutar `npm install` porque no hay dependencias externas.

## 4. Configuración

| Variable | Valor predeterminado | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `127.0.0.1` | Dirección de escucha |
| `DB_PATH` | `data/barberia.db` | Archivo SQLite |
| `SESSION_HOURS` | `12` | Duración de la sesión interna |
| `SLOT_MINUTES` | `30` | Intervalo base de disponibilidad |

Ejemplo en PowerShell:

```powershell
$env:PORT = '8080'
$env:DB_PATH = 'data/produccion.db'
npm start
```

La carpeta de la base se crea automáticamente. Para producción se recomienda guardar el archivo en un volumen persistente, restringir sus permisos y realizar copias de seguridad.

## 5. Arquitectura

El proyecto usa un monolito modular en capas:

- `public/`: interfaz responsive HTML, CSS y JavaScript.
- `src/server.js`: punto de arranque.
- `src/app.js`: rutas HTTP, casos de uso, autorización y reglas de negocio.
- `src/db.js`: esquema SQLite, datos iniciales y utilidades de horario.
- `src/security.js`: contraseñas, tokens y validación de credenciales.
- `src/http.js`: JSON, cookies, rutas dinámicas y archivos estáticos.
- `src/config.js`: configuración por variables de entorno.
- `tests/`: pruebas unitarias y de integración.
- `docs/`: análisis, diseño, pruebas y manuales.

La interfaz consume una API HTTP del mismo proceso. SQLite mantiene claves foráneas y aislamiento por `shop_id`. Esta arquitectura reduce la complejidad de despliegue sin perder separación lógica.

## 6. Base de datos

Las tablas principales son `shops`, `staff_users`, `shop_barbers`, `shop_services`, `shop_schedules`, `shop_appointments`, `transfer_payments` y `staff_sessions`.

Al iniciar por primera vez, `src/db.js` crea el esquema y datos de demostración. La reserva usa una transacción `BEGIN IMMEDIATE`; dentro de ella se vuelve a validar la disponibilidad antes de insertar la cita y el pago. Las reservas canceladas o rechazadas liberan el intervalo.

Respaldo con la aplicación detenida:

```powershell
Copy-Item data\barberia.db data\barberia-respaldo.db
```

## 7. Seguridad y permisos

- Contraseñas almacenadas con sal y derivación criptográfica.
- Sesiones mediante token aleatorio; en la base solo se conserva su hash.
- Cookie de sesión `HttpOnly` y `SameSite=Lax`.
- Roles: `platform_owner`, `shop_owner` y `barber`.
- El cliente invitado nunca crea una cuenta.
- El dueño de barbería solo gestiona su `shop_id`.
- El barbero solo procesa su propia cola QFlow.
- El dueño de plataforma administra todas las barberías y roles.

Para un despliegue público deben agregarse HTTPS, gestión segura de secretos, política de copias de seguridad y un proxy inverso.

## 8. Ejecución y diagnóstico

Modo normal:

```bash
npm start
```

Modo desarrollo con reinicio automático:

```bash
npm run dev
```

Comprobación de salud:

```bash
curl http://127.0.0.1:3000/api/health
```

Si el puerto está ocupado, cambie `PORT`. Si la base no se puede abrir, confirme permisos de escritura y el valor de `DB_PATH`. Los errores de validación de la API devuelven JSON y códigos HTTP 400, 401, 403, 404 o 409 según el caso.

## 9. Pruebas

```bash
npm test
```

La suite ejecuta cinco pruebas unitarias y cinco de integración. Verifica hash de contraseñas, política de claves, funciones de horario, reserva anónima, consulta de estado, confirmación de transferencia, QFlow, prevención de solapamientos, roles y administración multi-barbería.

Resultado esperado: `tests 10`, `pass 10`, `fail 0`.

## 10. Credenciales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Dueño de plataforma | `plataforma@barberia.local` | `Plataforma123!` |
| Dueño de barbería | `dueno@barberia.local` | `Dueno123!` |
| Barbero | `barbero@barberia.local` | `Barbero123!` |

Estas cuentas son solo para demostración y deben sustituirse antes de una publicación real.

## 11. Mantenimiento

1. Ejecutar `npm test` antes de cada entrega.
2. Respaldar la base antes de cambios de esquema.
3. Mantener separados código, base de datos y evidencias.
4. Revisar incidencias en `docs/REPORTE-PRUEBAS.md`.
5. Versionar cambios con commits descriptivos en la rama correspondiente.
