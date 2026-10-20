import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './config.js';
import { hashPassword } from './security.js';

// El esquema v2 convive con el prototipo anterior para conservar datos locales.
const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  address TEXT NOT NULL,
  phone TEXT,
  transfer_bank TEXT NOT NULL,
  transfer_account TEXT NOT NULL,
  transfer_holder TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('platform_owner','shop_owner','barber')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(shop_id) REFERENCES shops(id)
);
CREATE TABLE IF NOT EXISTS shop_barbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  user_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  specialty TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(shop_id) REFERENCES shops(id),
  FOREIGN KEY(user_id) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS shop_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 15 AND 240),
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(shop_id) REFERENCES shops(id)
);
CREATE TABLE IF NOT EXISTS shop_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(barber_id, weekday),
  FOREIGN KEY(barber_id) REFERENCES shop_barbers(id)
);
CREATE TABLE IF NOT EXISTS shop_appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  barber_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_email TEXT,
  appointment_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation' CHECK(status IN ('awaiting_confirmation','confirmed','in_service','completed','cancelled','rejected')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(shop_id) REFERENCES shops(id),
  FOREIGN KEY(barber_id) REFERENCES shop_barbers(id),
  FOREIGN KEY(service_id) REFERENCES shop_services(id)
);
CREATE INDEX IF NOT EXISTS idx_shop_appointments_slot ON shop_appointments(barber_id, appointment_date, start_time, end_time);
CREATE TABLE IF NOT EXISTS transfer_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  method TEXT NOT NULL DEFAULT 'transfer' CHECK(method='transfer'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','refunded')),
  reference TEXT NOT NULL,
  verified_by INTEGER,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(appointment_id) REFERENCES shop_appointments(id),
  FOREIGN KEY(verified_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES staff_users(id) ON DELETE CASCADE
);
`;

function seed(db) {
  if (db.prepare('SELECT COUNT(*) total FROM shops').get().total) return;
  const shopId=Number(db.prepare(`INSERT INTO shops(name,slug,address,phone,transfer_bank,transfer_account,transfer_holder)
    VALUES(?,?,?,?,?,?,?)`).run('Barbería Central','barberia-central','Av. Principal 123, Santo Domingo','809-555-0147','Banco Popular','000-123456-7','Barbería Central SRL').lastInsertRowid);
  const addUser=db.prepare('INSERT INTO staff_users(shop_id,name,email,phone,password_hash,role) VALUES(?,?,?,?,?,?)');
  addUser.run(null,'Dueño de la plataforma','plataforma@barberia.local','809-555-0100',hashPassword('Plataforma123!'),'platform_owner');
  addUser.run(shopId,'Dueño de Barbería Central','dueno@barberia.local','809-555-0101',hashPassword('Dueno123!'),'shop_owner');
  const barberUser=Number(addUser.run(shopId,'Mateo Santos','barbero@barberia.local','809-555-0102',hashPassword('Barbero123!'),'barber').lastInsertRowid);
  const addBarber=db.prepare('INSERT INTO shop_barbers(shop_id,user_id,name,specialty) VALUES(?,?,?,?)');
  const mateo=Number(addBarber.run(shopId,barberUser,'Mateo Santos','Cortes clásicos y barba').lastInsertRowid);
  const leo=Number(addBarber.run(shopId,null,'Leo Ramírez','Degradados y diseño').lastInsertRowid);
  const addService=db.prepare('INSERT INTO shop_services(shop_id,name,description,price_cents,duration_minutes) VALUES(?,?,?,?,?)');
  [
    ['Corte clásico','Corte personalizado, acabado y peinado.',80000,30],
    ['Corte y barba','Corte completo con perfilado y cuidado de barba.',120000,60],
    ['Barba premium','Perfilado, toalla caliente y acabado hidratante.',65000,30],
    ['Corte infantil','Servicio para niños de 5 a 12 años.',60000,30]
  ].forEach(row=>addService.run(shopId,...row));
  const addSchedule=db.prepare('INSERT INTO shop_schedules(barber_id,weekday,start_time,end_time) VALUES(?,?,?,?)');
  for(const barberId of [mateo,leo]){
    for(const day of [1,2,3,4,5]) addSchedule.run(barberId,day,'09:00','18:00');
    addSchedule.run(barberId,6,'09:00','15:00');
  }
}

export function createDatabase(filename=DB_PATH){
  if(filename!==':memory:') fs.mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec(schema);
  seed(db);
  return db;
}

export function minutes(time){const [h,m]=time.split(':').map(Number);return h*60+m;}
export function clock(total){return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
