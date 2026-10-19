import http from 'node:http';
import crypto from 'node:crypto';
import { createDatabase, minutes, clock } from './db.js';
import { getCookies, json, readJson, route, serveStatic } from './http.js';
import { hashPassword, hashToken, newSessionToken, passwordIsValid, verifyPassword } from './security.js';
import { SESSION_HOURS, SLOT_MINUTES } from './config.js';

const emailOk = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
const dateOk = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T12:00:00`));
const timeOk = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
const clean = value => String(value ?? '').trim();
const publicUser = u => u && ({ id:u.id, name:u.name, email:u.email, phone:u.phone, role:u.role });

function authUser(db, req) {
  const token = getCookies(req).session;
  if (!token) return null;
  return db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.active=1`).get(hashToken(token)) || null;
}

function requireRole(user, ...roles) {
  if (!user) throw Object.assign(new Error('Debes iniciar sesión.'), { status:401 });
  if (roles.length && !roles.includes(user.role)) throw Object.assign(new Error('No tienes permisos para esta acción.'), { status:403 });
}

function parseId(value, label='Identificador') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error(`${label} inválido.`), { status:400 });
  return id;
}

function getAppointmentRows(db, where='', params=[]) {
  return db.prepare(`SELECT a.*, u.name client_name, u.email client_email, b.name barber_name, s.name service_name, s.price_cents,
    COALESCE(p.status,'unpaid') payment_status, p.method payment_method
    FROM appointments a JOIN users u ON u.id=a.client_id JOIN barbers b ON b.id=a.barber_id JOIN services s ON s.id=a.service_id
    LEFT JOIN payments p ON p.appointment_id=a.id ${where} ORDER BY a.appointment_date DESC,a.start_time DESC`).all(...params);
}

function assertBookable(db, { barberId, serviceId, date, startTime, ignoreAppointmentId=null }) {
  if (!dateOk(date) || !timeOk(startTime)) throw Object.assign(new Error('Fecha u hora inválida.'), { status:400 });
  const service = db.prepare('SELECT * FROM services WHERE id=? AND active=1').get(serviceId);
  const barber = db.prepare('SELECT * FROM barbers WHERE id=? AND active=1').get(barberId);
  if (!service || !barber) throw Object.assign(new Error('Servicio o barbero no disponible.'), { status:400 });
  const requestedDate = new Date(`${date}T12:00:00`);
  const today = new Date(); today.setHours(0,0,0,0);
  if (requestedDate < today) throw Object.assign(new Error('No puedes reservar en una fecha pasada.'), { status:400 });
  const schedule = db.prepare('SELECT * FROM schedules WHERE barber_id=? AND weekday=? AND active=1').get(barberId, requestedDate.getDay());
  if (!schedule) throw Object.assign(new Error('El barbero no trabaja ese día.'), { status:409 });
  const start = minutes(startTime); const end = start + service.duration_minutes;
  if (start < minutes(schedule.start_time) || end > minutes(schedule.end_time) || start % SLOT_MINUTES !== 0) {
    throw Object.assign(new Error('El horario queda fuera de la jornada configurada.'), { status:409 });
  }
  const conflict = db.prepare(`SELECT id FROM appointments WHERE barber_id=? AND appointment_date=? AND status!='cancelled'
    AND id!=COALESCE(?, -1) AND ? < end_time AND ? > start_time LIMIT 1`).get(barberId, date, ignoreAppointmentId, startTime, clock(end));
  if (conflict) throw Object.assign(new Error('Ese horario acaba de ser reservado. Elige otro.'), { status:409 });
  return { service, endTime: clock(end) };
}

export function createApp({ db = createDatabase() } = {}) {
  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    const user = authUser(db, req);
    try {
      if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok:true, database:'connected' });
      if (req.method === 'GET' && pathname === '/api/me') return json(res, 200, { user:publicUser(user) });
      if (req.method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJson(req); const name=clean(body.name); const email=clean(body.email).toLowerCase(); const phone=clean(body.phone); const password=body.password;
        if (name.length < 2 || !emailOk(email) || !passwordIsValid(password)) throw Object.assign(new Error('Usa un nombre válido, correo válido y contraseña de 8+ caracteres con mayúscula, minúscula y número.'), {status:400});
        try { db.prepare('INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,\'client\')').run(name,email,phone,hashPassword(password)); }
        catch (e) { if (String(e).includes('UNIQUE')) throw Object.assign(new Error('Ese correo ya está registrado.'), {status:409}); throw e; }
        return json(res, 201, { message:'Cuenta creada. Ya puedes iniciar sesión.' });
      }
      if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body=await readJson(req); const account=db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(clean(body.email).toLowerCase());
        if (!account || !verifyPassword(body.password, account.password_hash)) throw Object.assign(new Error('Correo o contraseña incorrectos.'), {status:401});
        const token=newSessionToken(); const expires=new Date(Date.now()+SESSION_HOURS*3600000).toISOString();
        db.prepare('DELETE FROM sessions WHERE expires_at<=datetime(\'now\')').run();
        db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hashToken(token),account.id,expires);
        return json(res, 200, { user:publicUser(account) }, { 'Set-Cookie':`session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_HOURS*3600}` });
      }
      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        const token=getCookies(req).session; if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
        return json(res,200,{message:'Sesión cerrada.'},{'Set-Cookie':'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
      }
      if (req.method === 'GET' && pathname === '/api/services') return json(res,200,{services:db.prepare('SELECT * FROM services WHERE active=1 ORDER BY id').all()});
      if (req.method === 'GET' && pathname === '/api/barbers') return json(res,200,{barbers:db.prepare('SELECT id,name,specialty FROM barbers WHERE active=1 ORDER BY name').all()});
      if (req.method === 'GET' && pathname === '/api/availability') {
        const barberId=parseId(url.searchParams.get('barberId'),'Barbero'); const serviceId=parseId(url.searchParams.get('serviceId'),'Servicio'); const date=url.searchParams.get('date');
        if (!dateOk(date)) throw Object.assign(new Error('Selecciona una fecha válida.'),{status:400});
        const service=db.prepare('SELECT * FROM services WHERE id=? AND active=1').get(serviceId); const barber=db.prepare('SELECT * FROM barbers WHERE id=? AND active=1').get(barberId);
        if (!service || !barber) throw Object.assign(new Error('Servicio o barbero no disponible.'),{status:404});
        const day=new Date(`${date}T12:00:00`).getDay(); const schedule=db.prepare('SELECT * FROM schedules WHERE barber_id=? AND weekday=? AND active=1').get(barberId,day);
        if (!schedule) return json(res,200,{slots:[]});
        const booked=db.prepare(`SELECT start_time,end_time FROM appointments WHERE barber_id=? AND appointment_date=? AND status!='cancelled'`).all(barberId,date);
        const slots=[]; for(let start=minutes(schedule.start_time);start+service.duration_minutes<=minutes(schedule.end_time);start+=SLOT_MINUTES){
          const end=start+service.duration_minutes; if(!booked.some(a=>start<minutes(a.end_time)&&end>minutes(a.start_time))) slots.push(clock(start));
        }
        return json(res,200,{slots,schedule:{start:schedule.start_time,end:schedule.end_time}});
      }
      if (req.method === 'GET' && pathname === '/api/appointments') { requireRole(user,'client'); return json(res,200,{appointments:getAppointmentRows(db,'WHERE a.client_id=?',[user.id])}); }
      if (req.method === 'POST' && pathname === '/api/appointments') {
        requireRole(user,'client'); const body=await readJson(req); const barberId=parseId(body.barberId,'Barbero'); const serviceId=parseId(body.serviceId,'Servicio');
        db.exec('BEGIN IMMEDIATE');
        try { const {endTime}=assertBookable(db,{barberId,serviceId,date:body.date,startTime:body.startTime});
          const result=db.prepare('INSERT INTO appointments(client_id,barber_id,service_id,appointment_date,start_time,end_time,notes) VALUES(?,?,?,?,?,?,?)').run(user.id,barberId,serviceId,body.date,body.startTime,endTime,clean(body.notes)); db.exec('COMMIT');
          return json(res,201,{message:'Cita reservada.',id:Number(result.lastInsertRowid)});
        } catch(e){ db.exec('ROLLBACK'); throw e; }
      }
      let p=route('/api/appointments/:id',pathname);
      if (p && req.method === 'PATCH') {
        requireRole(user,'client'); const id=parseId(p.id,'Cita'); const current=db.prepare('SELECT * FROM appointments WHERE id=? AND client_id=?').get(id,user.id);
        if(!current) throw Object.assign(new Error('Cita no encontrada.'),{status:404}); if(current.status==='completed') throw Object.assign(new Error('Una cita completada no puede modificarse.'),{status:409});
        const body=await readJson(req);
        if(body.action==='cancel'){ db.prepare("UPDATE appointments SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id); return json(res,200,{message:'Cita cancelada.'}); }
        if(body.action!=='reschedule') throw Object.assign(new Error('Acción inválida.'),{status:400});
        db.exec('BEGIN IMMEDIATE'); try { const {endTime}=assertBookable(db,{barberId:current.barber_id,serviceId:current.service_id,date:body.date,startTime:body.startTime,ignoreAppointmentId:id}); db.prepare("UPDATE appointments SET appointment_date=?,start_time=?,end_time=?,status='scheduled',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(body.date,body.startTime,endTime,id); db.exec('COMMIT'); return json(res,200,{message:'Cita reprogramada.'}); } catch(e){db.exec('ROLLBACK');throw e;}
      }
      p=route('/api/appointments/:id/payment',pathname);
      if(p && req.method==='POST') {
        requireRole(user,'client'); const id=parseId(p.id,'Cita'); const apt=db.prepare(`SELECT a.*,s.price_cents FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.id=? AND a.client_id=?`).get(id,user.id);
        if(!apt) throw Object.assign(new Error('Cita no encontrada.'),{status:404}); if(apt.status==='cancelled') throw Object.assign(new Error('No se puede pagar una cita cancelada.'),{status:409});
        const body=await readJson(req); if(!['cash','card_demo','transfer'].includes(body.method)) throw Object.assign(new Error('Método de pago inválido.'),{status:400});
        const status=body.method==='cash'?'pending':'paid'; const ref=status==='paid'?`DEMO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`:null;
        try{db.prepare('INSERT INTO payments(appointment_id,amount_cents,method,status,reference,paid_at) VALUES(?,?,?,?,?,?)').run(id,apt.price_cents,body.method,status,ref,status==='paid'?new Date().toISOString():null);}catch(e){if(String(e).includes('UNIQUE')) throw Object.assign(new Error('La cita ya tiene un pago registrado.'),{status:409});throw e;}
        return json(res,201,{message:status==='paid'?'Pago demostrativo aprobado.':'Pago en efectivo pendiente de confirmación.',status,reference:ref});
      }
      if (req.method==='GET' && pathname==='/api/barber/appointments') {
        requireRole(user,'barber'); const barber=db.prepare('SELECT id FROM barbers WHERE user_id=?').get(user.id); return json(res,200,{appointments:barber?getAppointmentRows(db,'WHERE a.barber_id=?',[barber.id]):[]});
      }
      if (req.method==='GET' && pathname==='/api/admin/dashboard') {
        requireRole(user,'admin'); return json(res,200,{counts:{clients:db.prepare("SELECT COUNT(*) total FROM users WHERE role='client'").get().total,appointments:db.prepare("SELECT COUNT(*) total FROM appointments").get().total,pending:db.prepare("SELECT COUNT(*) total FROM appointments WHERE status IN ('scheduled','confirmed')").get().total,revenue_cents:db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM payments WHERE status='paid'").get().total},appointments:getAppointmentRows(db).slice(0,30),payments:db.prepare(`SELECT p.*,u.name client_name,s.name service_name FROM payments p JOIN appointments a ON a.id=p.appointment_id JOIN users u ON u.id=a.client_id JOIN services s ON s.id=a.service_id ORDER BY p.created_at DESC`).all(),clients:db.prepare("SELECT id,name,email,phone,active,created_at FROM users WHERE role='client' ORDER BY created_at DESC").all()});
      }
      if (req.method==='GET' && pathname==='/api/admin/services') { requireRole(user,'admin'); return json(res,200,{services:db.prepare('SELECT * FROM services ORDER BY id').all()}); }
      if (req.method==='POST' && pathname==='/api/admin/services') {
        requireRole(user,'admin'); const b=await readJson(req); const name=clean(b.name),desc=clean(b.description),price=Number(b.priceCents),duration=Number(b.durationMinutes);
        if(name.length<2||desc.length<4||!Number.isInteger(price)||price<0||!Number.isInteger(duration)||duration<15||duration>240) throw Object.assign(new Error('Datos de servicio inválidos.'),{status:400});
        const r=db.prepare('INSERT INTO services(name,description,price_cents,duration_minutes) VALUES(?,?,?,?)').run(name,desc,price,duration); return json(res,201,{id:Number(r.lastInsertRowid),message:'Servicio creado.'});
      }
      p=route('/api/admin/services/:id',pathname);
      if(p&&req.method==='PATCH') { requireRole(user,'admin'); const id=parseId(p.id,'Servicio'); const b=await readJson(req); const current=db.prepare('SELECT * FROM services WHERE id=?').get(id); if(!current) throw Object.assign(new Error('Servicio no encontrado.'),{status:404}); db.prepare('UPDATE services SET name=?,description=?,price_cents=?,duration_minutes=?,active=? WHERE id=?').run(clean(b.name??current.name),clean(b.description??current.description),Number(b.priceCents??current.price_cents),Number(b.durationMinutes??current.duration_minutes),b.active===undefined?current.active:Number(Boolean(b.active)),id); return json(res,200,{message:'Servicio actualizado.'}); }
      if (req.method==='GET' && pathname==='/api/admin/barbers') { requireRole(user,'admin'); return json(res,200,{barbers:db.prepare('SELECT * FROM barbers ORDER BY name').all(),schedules:db.prepare('SELECT * FROM schedules ORDER BY barber_id,weekday').all()}); }
      if (req.method==='POST' && pathname==='/api/admin/barbers') { requireRole(user,'admin'); const b=await readJson(req); const name=clean(b.name); if(name.length<2) throw Object.assign(new Error('Nombre inválido.'),{status:400}); const r=db.prepare('INSERT INTO barbers(name,specialty) VALUES(?,?)').run(name,clean(b.specialty)); return json(res,201,{id:Number(r.lastInsertRowid),message:'Barbero creado.'}); }
      p=route('/api/admin/barbers/:id',pathname);
      if(p&&req.method==='PATCH'){ requireRole(user,'admin'); const id=parseId(p.id,'Barbero'); const b=await readJson(req); const current=db.prepare('SELECT * FROM barbers WHERE id=?').get(id); if(!current) throw Object.assign(new Error('Barbero no encontrado.'),{status:404}); db.prepare('UPDATE barbers SET name=?,specialty=?,active=? WHERE id=?').run(clean(b.name??current.name),clean(b.specialty??current.specialty),b.active===undefined?current.active:Number(Boolean(b.active)),id); return json(res,200,{message:'Barbero actualizado.'}); }
      if (req.method==='POST' && pathname==='/api/admin/schedules') { requireRole(user,'admin'); const b=await readJson(req); const barberId=parseId(b.barberId,'Barbero'); const weekday=Number(b.weekday); if(!Number.isInteger(weekday)||weekday<0||weekday>6||!timeOk(b.startTime)||!timeOk(b.endTime)||minutes(b.startTime)>=minutes(b.endTime)) throw Object.assign(new Error('Horario inválido.'),{status:400}); db.prepare(`INSERT INTO schedules(barber_id,weekday,start_time,end_time,active) VALUES(?,?,?,?,1) ON CONFLICT(barber_id,weekday) DO UPDATE SET start_time=excluded.start_time,end_time=excluded.end_time,active=1`).run(barberId,weekday,b.startTime,b.endTime); return json(res,200,{message:'Horario guardado.'}); }
      p=route('/api/admin/appointments/:id',pathname);
      if(p&&req.method==='PATCH'){ requireRole(user,'admin'); const id=parseId(p.id,'Cita'); const b=await readJson(req); if(!['scheduled','confirmed','completed','cancelled'].includes(b.status)) throw Object.assign(new Error('Estado inválido.'),{status:400}); const r=db.prepare('UPDATE appointments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(b.status,id); if(!r.changes) throw Object.assign(new Error('Cita no encontrada.'),{status:404}); return json(res,200,{message:'Estado actualizado.'}); }
      p=route('/api/admin/payments/:id',pathname);
      if(p&&req.method==='PATCH'){ requireRole(user,'admin'); const id=parseId(p.id,'Pago'); const b=await readJson(req); if(!['pending','paid','refunded','failed'].includes(b.status)) throw Object.assign(new Error('Estado inválido.'),{status:400}); const r=db.prepare('UPDATE payments SET status=?,paid_at=CASE WHEN ?=\'paid\' THEN COALESCE(paid_at,CURRENT_TIMESTAMP) ELSE paid_at END WHERE id=?').run(b.status,b.status,id); if(!r.changes) throw Object.assign(new Error('Pago no encontrado.'),{status:404}); return json(res,200,{message:'Pago actualizado.'}); }
      if (pathname.startsWith('/api/')) return json(res,404,{error:'Ruta no encontrada.'});
      if (await serveStatic(pathname,res)) return;
      return serveStatic('/',res);
    } catch(error) {
      console.error(error.status ? `${req.method} ${pathname}: ${error.message}` : error);
      return json(res,error.status||500,{error:error.status?error.message:'Ocurrió un error interno.'});
    }
  };
  const server=http.createServer(handler);
  server.on('close',()=>db.close());
  return { server, db, handler };
}
