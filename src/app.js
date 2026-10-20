import http from 'node:http';
import { createDatabase, minutes, clock } from './db.js';
import { getCookies, json, readJson, route, serveStatic } from './http.js';
import { hashPassword, hashToken, newSessionToken, passwordIsValid, verifyPassword } from './security.js';
import { SESSION_HOURS, SLOT_MINUTES } from './config.js';

const emailOk=v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v));
const dateOk=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(Date.parse(`${v}T12:00:00`));
const timeOk=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''));
const clean=v=>String(v??'').trim();
const publicUser=u=>u&&({id:u.id,shopId:u.shop_id,name:u.name,email:u.email,phone:u.phone,role:u.role});

function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function parseId(value,label='Identificador'){const id=Number(value);if(!Number.isInteger(id)||id<1)fail(`${label} inválido.`);return id;}
function authUser(db,req){const token=getCookies(req).session;if(!token)return null;return db.prepare(`SELECT u.* FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.active=1`).get(hashToken(token))||null;}
function requireRole(user,...roles){if(!user)fail('Debes iniciar sesión.',401);if(roles.length&&!roles.includes(user.role))fail('No tienes permisos para esta acción.',403);}
function scopeShop(user,requested){
  requireRole(user,'shop_owner','platform_owner');
  if(user.role==='shop_owner') return Number(user.shop_id);
  return parseId(requested,'Barbería');
}
function getAppointmentRows(db,where='',params=[]){return db.prepare(`SELECT a.*,b.name barber_name,s.name service_name,s.price_cents,sh.name shop_name,
  p.id payment_id,p.status payment_status,p.reference transfer_reference
  FROM shop_appointments a JOIN shop_barbers b ON b.id=a.barber_id JOIN shop_services s ON s.id=a.service_id
  JOIN shops sh ON sh.id=a.shop_id JOIN transfer_payments p ON p.appointment_id=a.id ${where}
  ORDER BY a.appointment_date,a.start_time`).all(...params);}
function assertShopActive(db,shopId){const shop=db.prepare('SELECT * FROM shops WHERE id=? AND active=1').get(shopId);if(!shop)fail('La barbería no está disponible.',404);return shop;}
function assertBookable(db,{shopId,barberId,serviceId,date,startTime,ignoreAppointmentId=null}){
  if(!dateOk(date)||!timeOk(startTime))fail('Fecha u hora inválida.');
  assertShopActive(db,shopId);
  const service=db.prepare('SELECT * FROM shop_services WHERE id=? AND shop_id=? AND active=1').get(serviceId,shopId);
  const barber=db.prepare('SELECT * FROM shop_barbers WHERE id=? AND shop_id=? AND active=1').get(barberId,shopId);
  if(!service||!barber)fail('Servicio o barbero no disponible.');
  const requested=new Date(`${date}T12:00:00`),today=new Date();today.setHours(0,0,0,0);if(requested<today)fail('No puedes reservar en una fecha pasada.');
  const schedule=db.prepare('SELECT * FROM shop_schedules WHERE barber_id=? AND weekday=? AND active=1').get(barberId,requested.getDay());
  if(!schedule)fail('El barbero no trabaja ese día.',409);
  const start=minutes(startTime),end=start+service.duration_minutes;
  if(start<minutes(schedule.start_time)||end>minutes(schedule.end_time)||start%SLOT_MINUTES!==0)fail('El horario queda fuera de la jornada configurada.',409);
  const conflict=db.prepare(`SELECT id FROM shop_appointments WHERE barber_id=? AND appointment_date=? AND status NOT IN ('cancelled','rejected')
    AND id!=COALESCE(?,-1) AND ?<end_time AND ?>start_time LIMIT 1`).get(barberId,date,ignoreAppointmentId,startTime,clock(end));
  if(conflict)fail('Ese horario acaba de ser reservado. Elige otro.',409);
  return {service,endTime:clock(end)};
}

export function createApp({db=createDatabase()}={}){
  const handler=async(req,res)=>{
    const url=new URL(req.url,'http://localhost');const {pathname}=url;const user=authUser(db,req);
    try{
      if(req.method==='GET'&&pathname==='/api/health')return json(res,200,{ok:true,database:'connected',mode:'multi-shop'});
      if(req.method==='GET'&&pathname==='/api/me')return json(res,200,{user:publicUser(user)});
      if(req.method==='POST'&&pathname==='/api/auth/login'){
        const b=await readJson(req),account=db.prepare('SELECT * FROM staff_users WHERE email=? AND active=1').get(clean(b.email).toLowerCase());
        if(!account||!verifyPassword(b.password,account.password_hash))fail('Correo o contraseña incorrectos.',401);
        const token=newSessionToken(),expires=new Date(Date.now()+SESSION_HOURS*3600000).toISOString();
        db.prepare("DELETE FROM staff_sessions WHERE expires_at<=datetime('now')").run();db.prepare('INSERT INTO staff_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hashToken(token),account.id,expires);
        return json(res,200,{user:publicUser(account)},{'Set-Cookie':`session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_HOURS*3600}`});
      }
      if(req.method==='POST'&&pathname==='/api/auth/logout'){const token=getCookies(req).session;if(token)db.prepare('DELETE FROM staff_sessions WHERE token_hash=?').run(hashToken(token));return json(res,200,{message:'Sesión cerrada.'},{'Set-Cookie':'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});}

      if(req.method==='GET'&&pathname==='/api/shops')return json(res,200,{shops:db.prepare('SELECT id,name,address,phone FROM shops WHERE active=1 ORDER BY name').all()});
      if(req.method==='GET'&&pathname==='/api/catalog'){
        const shopId=parseId(url.searchParams.get('shopId'),'Barbería');const shop=assertShopActive(db,shopId);
        return json(res,200,{shop,services:db.prepare('SELECT * FROM shop_services WHERE shop_id=? AND active=1 ORDER BY id').all(shopId),barbers:db.prepare('SELECT id,name,specialty FROM shop_barbers WHERE shop_id=? AND active=1 ORDER BY name').all(shopId)});
      }
      if(req.method==='GET'&&pathname==='/api/availability'){
        const shopId=parseId(url.searchParams.get('shopId'),'Barbería'),barberId=parseId(url.searchParams.get('barberId'),'Barbero'),serviceId=parseId(url.searchParams.get('serviceId'),'Servicio'),date=url.searchParams.get('date');
        if(!dateOk(date))fail('Selecciona una fecha válida.');
        const service=db.prepare('SELECT * FROM shop_services WHERE id=? AND shop_id=? AND active=1').get(serviceId,shopId),barber=db.prepare('SELECT * FROM shop_barbers WHERE id=? AND shop_id=? AND active=1').get(barberId,shopId);if(!service||!barber)fail('Servicio o barbero no disponible.',404);
        const day=new Date(`${date}T12:00:00`).getDay(),schedule=db.prepare('SELECT * FROM shop_schedules WHERE barber_id=? AND weekday=? AND active=1').get(barberId,day);if(!schedule)return json(res,200,{slots:[]});
        const booked=db.prepare(`SELECT start_time,end_time FROM shop_appointments WHERE barber_id=? AND appointment_date=? AND status NOT IN ('cancelled','rejected')`).all(barberId,date),slots=[];
        for(let start=minutes(schedule.start_time);start+service.duration_minutes<=minutes(schedule.end_time);start+=SLOT_MINUTES){const end=start+service.duration_minutes;if(!booked.some(a=>start<minutes(a.end_time)&&end>minutes(a.start_time)))slots.push(clock(start));}
        return json(res,200,{slots,schedule:{start:schedule.start_time,end:schedule.end_time}});
      }
      if(req.method==='POST'&&pathname==='/api/appointments'){
        const b=await readJson(req),shopId=parseId(b.shopId,'Barbería'),barberId=parseId(b.barberId,'Barbero'),serviceId=parseId(b.serviceId,'Servicio');
        const name=clean(b.guestName),phone=clean(b.guestPhone),email=clean(b.guestEmail).toLowerCase(),reference=clean(b.transferReference);
        if(name.length<2||phone.replace(/\D/g,'').length<7||!emailOk(email)||reference.length<4)fail('Indica nombre, teléfono y referencia de transferencia válidos.');
        db.exec('BEGIN IMMEDIATE');
        try{const {service,endTime}=assertBookable(db,{shopId,barberId,serviceId,date:b.date,startTime:b.startTime});
          const result=db.prepare(`INSERT INTO shop_appointments(shop_id,barber_id,service_id,guest_name,guest_phone,guest_email,appointment_date,start_time,end_time,notes)
            VALUES(?,?,?,?,?,?,?,?,?,?)`).run(shopId,barberId,serviceId,name,phone,email,b.date,b.startTime,endTime,clean(b.notes));
          const id=Number(result.lastInsertRowid);db.prepare('INSERT INTO transfer_payments(appointment_id,amount_cents,reference) VALUES(?,?,?)').run(id,service.price_cents,reference);db.exec('COMMIT');
          return json(res,201,{id,code:`BC-${String(id).padStart(5,'0')}`,status:'awaiting_confirmation',message:'Reserva recibida. El dueño verificará la transferencia antes de confirmarla.'});
        }catch(e){db.exec('ROLLBACK');throw e;}
      }
      if(req.method==='GET'&&pathname==='/api/appointments/lookup'){
        const id=parseId(String(url.searchParams.get('code')||'').replace(/\D/g,''),'Código'),phone=clean(url.searchParams.get('phone'));
        const row=getAppointmentRows(db,'WHERE a.id=? AND a.guest_phone=?',[id,phone])[0];if(!row)fail('No encontramos una reserva con esos datos.',404);return json(res,200,{appointment:row});
      }

      if(req.method==='GET'&&pathname==='/api/qflow'){
        requireRole(user,'barber');const barber=db.prepare('SELECT id FROM shop_barbers WHERE user_id=? AND active=1').get(user.id);
        return json(res,200,{appointments:barber?getAppointmentRows(db,"WHERE a.barber_id=? AND a.status IN ('confirmed','in_service')",[barber.id]):[]});
      }
      let p=route('/api/qflow/:id',pathname);
      if(p&&req.method==='PATCH'){
        requireRole(user,'barber');const id=parseId(p.id,'Reserva'),b=await readJson(req),barber=db.prepare('SELECT id FROM shop_barbers WHERE user_id=?').get(user.id);if(!barber)fail('Barbero sin perfil asociado.',403);
        if(!['in_service','completed'].includes(b.status))fail('Estado QFlow inválido.');
        const expected=b.status==='in_service'?'confirmed':'in_service',result=db.prepare('UPDATE shop_appointments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND barber_id=? AND status=?').run(b.status,id,barber.id,expected);if(!result.changes)fail('La reserva no puede avanzar desde su estado actual.',409);return json(res,200,{message:'QFlow actualizado.'});
      }

      if(req.method==='GET'&&pathname==='/api/owner/dashboard'){
        const shopId=scopeShop(user,url.searchParams.get('shopId'));assertShopActive(db,shopId);
        const appointments=getAppointmentRows(db,'WHERE a.shop_id=?',[shopId]);
        return json(res,200,{shop:db.prepare('SELECT * FROM shops WHERE id=?').get(shopId),counts:{appointments:appointments.length,awaiting:appointments.filter(a=>a.status==='awaiting_confirmation').length,confirmed:appointments.filter(a=>a.status==='confirmed').length,revenue_cents:appointments.filter(a=>a.payment_status==='verified').reduce((n,a)=>n+a.price_cents,0)},appointments,payments:appointments,services:db.prepare('SELECT * FROM shop_services WHERE shop_id=? ORDER BY id').all(shopId),barbers:db.prepare('SELECT * FROM shop_barbers WHERE shop_id=? ORDER BY name').all(shopId),schedules:db.prepare(`SELECT sc.* FROM shop_schedules sc JOIN shop_barbers b ON b.id=sc.barber_id WHERE b.shop_id=? ORDER BY sc.barber_id,sc.weekday`).all(shopId)});
      }
      if(req.method==='POST'&&pathname==='/api/owner/services'){
        const b=await readJson(req),shopId=scopeShop(user,b.shopId),name=clean(b.name),desc=clean(b.description),price=Number(b.priceCents),duration=Number(b.durationMinutes);if(name.length<2||desc.length<4||!Number.isInteger(price)||price<0||!Number.isInteger(duration)||duration<15||duration>240)fail('Datos de servicio inválidos.');
        const r=db.prepare('INSERT INTO shop_services(shop_id,name,description,price_cents,duration_minutes) VALUES(?,?,?,?,?)').run(shopId,name,desc,price,duration);return json(res,201,{id:Number(r.lastInsertRowid),message:'Servicio creado.'});
      }
      if(req.method==='POST'&&pathname==='/api/owner/barbers'){
        const b=await readJson(req),shopId=scopeShop(user,b.shopId),name=clean(b.name);if(name.length<2)fail('Nombre inválido.');const r=db.prepare('INSERT INTO shop_barbers(shop_id,name,specialty) VALUES(?,?,?)').run(shopId,name,clean(b.specialty));return json(res,201,{id:Number(r.lastInsertRowid),message:'Barbero creado.'});
      }
      if(req.method==='POST'&&pathname==='/api/owner/schedules'){
        const b=await readJson(req),shopId=scopeShop(user,b.shopId),barberId=parseId(b.barberId,'Barbero'),weekday=Number(b.weekday);if(!db.prepare('SELECT id FROM shop_barbers WHERE id=? AND shop_id=?').get(barberId,shopId))fail('Barbero inválido.');if(!Number.isInteger(weekday)||weekday<0||weekday>6||!timeOk(b.startTime)||!timeOk(b.endTime)||minutes(b.startTime)>=minutes(b.endTime))fail('Horario inválido.');db.prepare(`INSERT INTO shop_schedules(barber_id,weekday,start_time,end_time,active) VALUES(?,?,?,?,1) ON CONFLICT(barber_id,weekday) DO UPDATE SET start_time=excluded.start_time,end_time=excluded.end_time,active=1`).run(barberId,weekday,b.startTime,b.endTime);return json(res,200,{message:'Horario guardado.'});
      }
      p=route('/api/owner/appointments/:id',pathname);
      if(p&&req.method==='PATCH'){
        const b=await readJson(req),shopId=scopeShop(user,b.shopId),id=parseId(p.id,'Reserva'),appointment=db.prepare('SELECT * FROM shop_appointments WHERE id=? AND shop_id=?').get(id,shopId);if(!appointment)fail('Reserva no encontrada.',404);
        if(b.action==='confirm'){if(appointment.status!=='awaiting_confirmation')fail('La reserva ya fue procesada.',409);db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE transfer_payments SET status='verified',verified_by=?,verified_at=CURRENT_TIMESTAMP WHERE appointment_id=?").run(user.id,id);db.prepare("UPDATE shop_appointments SET status='confirmed',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);db.exec('COMMIT');return json(res,200,{message:'Transferencia validada y reserva enviada a QFlow.'});}catch(e){db.exec('ROLLBACK');throw e;}}
        if(b.action==='reject'){db.prepare("UPDATE transfer_payments SET status='rejected' WHERE appointment_id=?").run(id);db.prepare("UPDATE shop_appointments SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);return json(res,200,{message:'Reserva rechazada.'});}
        if(b.action==='cancel'){db.prepare("UPDATE shop_appointments SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);return json(res,200,{message:'Reserva cancelada.'});}
        fail('Acción inválida.');
      }

      if(req.method==='GET'&&pathname==='/api/platform/dashboard'){
        requireRole(user,'platform_owner');return json(res,200,{shops:db.prepare(`SELECT sh.*,(SELECT COUNT(*) FROM staff_users u WHERE u.shop_id=sh.id) staff_count,(SELECT COUNT(*) FROM shop_appointments a WHERE a.shop_id=sh.id) appointment_count FROM shops sh ORDER BY sh.name`).all(),users:db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.role,u.active,u.shop_id,sh.name shop_name FROM staff_users u LEFT JOIN shops sh ON sh.id=u.shop_id ORDER BY u.created_at DESC`).all(),appointments:getAppointmentRows(db)});
      }
      if(req.method==='POST'&&pathname==='/api/platform/shops'){
        requireRole(user,'platform_owner');const b=await readJson(req),name=clean(b.name),slug=clean(b.slug).toLowerCase().replace(/[^a-z0-9-]/g,'-');if(name.length<2||slug.length<2||clean(b.address).length<4||clean(b.transferAccount).length<4)fail('Completa los datos de la barbería y transferencia.');
        try{const r=db.prepare(`INSERT INTO shops(name,slug,address,phone,transfer_bank,transfer_account,transfer_holder) VALUES(?,?,?,?,?,?,?)`).run(name,slug,clean(b.address),clean(b.phone),clean(b.transferBank),clean(b.transferAccount),clean(b.transferHolder));return json(res,201,{id:Number(r.lastInsertRowid),message:'Barbería agregada.'});}catch(e){if(String(e).includes('UNIQUE'))fail('Ese identificador ya existe.',409);throw e;}
      }
      p=route('/api/platform/shops/:id',pathname);
      if(p&&req.method==='PATCH'){requireRole(user,'platform_owner');const id=parseId(p.id,'Barbería'),b=await readJson(req),r=db.prepare('UPDATE shops SET active=? WHERE id=?').run(Number(Boolean(b.active)),id);if(!r.changes)fail('Barbería no encontrada.',404);return json(res,200,{message:'Estado actualizado.'});}
      if(req.method==='POST'&&pathname==='/api/platform/users'){
        requireRole(user,'platform_owner');const b=await readJson(req),role=clean(b.role),shopId=role==='platform_owner'?null:parseId(b.shopId,'Barbería'),name=clean(b.name),email=clean(b.email).toLowerCase();if(!['platform_owner','shop_owner','barber'].includes(role)||name.length<2||!emailOk(email)||!passwordIsValid(b.password))fail('Datos de usuario o contraseña inválidos.');
        db.exec('BEGIN IMMEDIATE');try{const r=db.prepare('INSERT INTO staff_users(shop_id,name,email,phone,password_hash,role) VALUES(?,?,?,?,?,?)').run(shopId,name,email,clean(b.phone),hashPassword(b.password),role);const userId=Number(r.lastInsertRowid);if(role==='barber')db.prepare('INSERT INTO shop_barbers(shop_id,user_id,name,specialty) VALUES(?,?,?,?)').run(shopId,userId,name,clean(b.specialty));db.exec('COMMIT');return json(res,201,{id:userId,message:'Usuario y rol creados.'});}catch(e){db.exec('ROLLBACK');if(String(e).includes('UNIQUE'))fail('Ese correo ya existe.',409);throw e;}
      }

      if(pathname.startsWith('/api/'))return json(res,404,{error:'Ruta no encontrada.'});
      if(await serveStatic(pathname,res))return;
      return serveStatic('/',res);
    }catch(error){if(db.isTransaction)try{db.exec('ROLLBACK');}catch{};const status=error.status||500;if(status>=500)console.error(error);else console.warn(`${req.method} ${pathname}: ${error.message}`);return json(res,status,{error:status>=500?'Error interno del servidor.':error.message});}
  };
  const server=http.createServer(handler);server.on('close',()=>db.close());return {server,db,handler};
}
