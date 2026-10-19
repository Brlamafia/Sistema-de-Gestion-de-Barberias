# Documento de diseño

## Arquitectura propuesta

Monolito modular en capas: interfaz web, API HTTP, servicios de dominio y persistencia SQLite. La arquitectura reduce la complejidad operativa y permite mantener módulos separados sin introducir microservicios innecesarios para el alcance del SRS.

## Casos de uso

```mermaid
flowchart LR
  C[Cliente] --> CU1[Registrarse e iniciar sesión]
  C --> CU2[Consultar servicios]
  C --> CU3[Ver disponibilidad]
  C --> CU4[Agendar cita]
  C --> CU5[Cancelar o reprogramar cita]
  C --> CU6[Consultar historial]
  C --> CU7[Registrar pago]
  B[Barbero] --> CU8[Consultar agenda]
  A[Administrador] --> CU9[Gestionar servicios y precios]
  A --> CU10[Gestionar barberos y horarios]
  A --> CU11[Gestionar citas]
  A --> CU12[Consultar clientes y pagos]
  CU4 --> CU3
  CU5 --> CU3
```

## Clases UML

```mermaid
classDiagram
  class Usuario { +id +nombre +correo +telefono +passwordHash +rol +activo }
  class Barbero { +id +nombre +especialidad +activo }
  class Servicio { +id +nombre +descripcion +precioCentavos +duracionMinutos +activo }
  class Horario { +id +diaSemana +horaInicio +horaFin +activo }
  class Cita { +id +fecha +horaInicio +horaFin +estado +notas }
  class Pago { +id +montoCentavos +metodo +estado +referencia +fechaPago }
  class Sesion { +tokenHash +expiraEn }
  Usuario "1" --> "0..1" Barbero
  Usuario "1" --> "0..*" Cita : cliente
  Usuario "1" --> "0..*" Sesion
  Barbero "1" --> "0..*" Horario
  Barbero "1" --> "0..*" Cita
  Servicio "1" --> "0..*" Cita
  Cita "1" --> "0..1" Pago
```

## Secuencia 1: reservar una cita

```mermaid
sequenceDiagram
  actor Cliente
  participant Web
  participant API
  participant DB
  Cliente->>Web: Selecciona servicio, barbero y fecha
  Web->>API: GET /availability
  API->>DB: Consulta jornada y citas activas
  DB-->>API: Horarios y ocupación
  API-->>Web: Espacios disponibles
  Cliente->>Web: Confirma horario
  Web->>API: POST /appointments
  API->>DB: BEGIN IMMEDIATE
  API->>DB: Verifica solapamiento e inserta
  DB-->>API: Cita creada
  API->>DB: COMMIT
  API-->>Web: Confirmación
```

## Secuencia 2: registrar un pago

```mermaid
sequenceDiagram
  actor Cliente
  participant Web
  participant API
  participant DB
  Cliente->>Web: Elige método de pago
  Web->>API: POST /appointments/:id/payment
  API->>DB: Valida propiedad y estado de la cita
  API->>DB: Registra monto, método y estado
  DB-->>API: Pago creado
  API-->>Web: Estado y referencia
```

## Modelo entidad relación

```mermaid
erDiagram
  USERS ||--o| BARBERS : representa
  USERS ||--o{ SESSIONS : inicia
  USERS ||--o{ APPOINTMENTS : reserva
  BARBERS ||--o{ SCHEDULES : configura
  BARBERS ||--o{ APPOINTMENTS : atiende
  SERVICES ||--o{ APPOINTMENTS : corresponde
  APPOINTMENTS ||--o| PAYMENTS : registra
```

## Modelo relacional

| Tabla | Atributos principales |
| --- | --- |
| users | id PK, name, email UQ, phone, password_hash, role, active, created_at |
| barbers | id PK, user_id FK/UQ, name, specialty, active |
| services | id PK, name, description, price_cents, duration_minutes, active |
| schedules | id PK, barber_id FK, weekday, start_time, end_time, active, UQ(barber_id, weekday) |
| appointments | id PK, client_id FK, barber_id FK, service_id FK, appointment_date, start_time, end_time, status, notes, timestamps |
| payments | id PK, appointment_id FK/UQ, amount_cents, method, status, reference, paid_at, created_at |
| sessions | token_hash PK, user_id FK, expires_at |

## Prototipos de interfaz

La implementación contiene los prototipos funcionales de inicio y catálogo, reserva con disponibilidad y panel administrativo. Las capturas se incluyen en el documento formal del Entregable 2.
