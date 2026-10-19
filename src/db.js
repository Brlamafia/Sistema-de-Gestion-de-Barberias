import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './config.js';
import { hashPassword } from './security.js';

const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('client','admin','barber')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS barbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  specialty TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 15 AND 240),
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(barber_id, weekday),
  FOREIGN KEY(barber_id) REFERENCES barbers(id)
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  barber_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  appointment_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','confirmed','completed','cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(client_id) REFERENCES users(id),
  FOREIGN KEY(barber_id) REFERENCES barbers(id),
  FOREIGN KEY(service_id) REFERENCES services(id)
);
CREATE INDEX IF NOT EXISTS idx_appointments_slot ON appointments(barber_id, appointment_date, start_time, end_time);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  method TEXT NOT NULL CHECK(method IN ('cash','card_demo','transfer')),
  status TEXT NOT NULL CHECK(status IN ('pending','paid','refunded','failed')),
  reference TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(appointment_id) REFERENCES appointments(id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  if (count) return;
  const addUser = db.prepare('INSERT INTO users (name,email,phone,password_hash,role) VALUES (?,?,?,?,?)');
  const admin = addUser.run('Administración', 'admin@cortecentral.do', '809-555-0101', hashPassword('Admin123!'), 'admin').lastInsertRowid;
  const barberUser = addUser.run('Mateo Santos', 'barbero@cortecentral.do', '809-555-0102', hashPassword('Barber123!'), 'barber').lastInsertRowid;
  addUser.run('Cliente Demo', 'cliente@cortecentral.do', '809-555-0103', hashPassword('Cliente123!'), 'client');
  void admin;
  const addBarber = db.prepare('INSERT INTO barbers (user_id,name,specialty) VALUES (?,?,?)');
  const mateo = addBarber.run(barberUser, 'Mateo Santos', 'Cortes clásicos y barba').lastInsertRowid;
  const leo = addBarber.run(null, 'Leo Ramírez', 'Degradados y diseño').lastInsertRowid;
  const services = [
    ['Corte clásico', 'Corte personalizado, acabado y peinado.', 80000, 30],
    ['Corte y barba', 'Corte completo con perfilado y cuidado de barba.', 120000, 60],
    ['Barba premium', 'Perfilado, toalla caliente y acabado hidratante.', 65000, 30],
    ['Corte infantil', 'Servicio para niños de 5 a 12 años.', 60000, 30]
  ];
  const addService = db.prepare('INSERT INTO services (name,description,price_cents,duration_minutes) VALUES (?,?,?,?)');
  services.forEach(row => addService.run(...row));
  const addSchedule = db.prepare('INSERT INTO schedules (barber_id,weekday,start_time,end_time) VALUES (?,?,?,?)');
  for (const barberId of [mateo, leo]) {
    for (const day of [1,2,3,4,5]) addSchedule.run(barberId, day, '09:00', '18:00');
    addSchedule.run(barberId, 6, '09:00', '15:00');
  }
}

export function createDatabase(filename = DB_PATH) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(schema);
  seed(db);
  return db;
}

export function minutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function clock(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
