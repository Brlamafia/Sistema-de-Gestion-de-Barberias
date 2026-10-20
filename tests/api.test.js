import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

let server,base;
test.before(()=>new Promise(resolve=>{({server}=createApp({db:createDatabase(':memory:')}));server.listen(0,'127.0.0.1',()=>{base=`http://127.0.0.1:${server.address().port}`;resolve();});}));
test.after(()=>new Promise(resolve=>server.close(resolve)));
async function request(path,{cookie,...options}={}){const res=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(options.headers||{})}}),body=await res.json();return {res,body,cookie:res.headers.get('set-cookie')?.split(';')[0]};}
async function login(email,password){return request('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});}
const booking=(barberId=1,serviceId=1,startTime='09:00',name='Ana Pérez',phone='8095550199')=>({shopId:1,barberId,serviceId,date:'2030-10-21',startTime,guestName:name,guestPhone:phone,guestEmail:'ana@example.com',transferReference:'TRX-2026-001'});

test('integración: un cliente reserva sin crear cuenta y consulta el estado',async()=>{
  const available=await request('/api/availability?shopId=1&barberId=1&serviceId=1&date=2030-10-21');assert.equal(available.res.status,200);assert.ok(available.body.slots.includes('09:00'));
  const booked=await request('/api/appointments',{method:'POST',body:JSON.stringify(booking())});assert.equal(booked.res.status,201);assert.equal(booked.body.status,'awaiting_confirmation');assert.match(booked.body.code,/^BC-/);
  const lookup=await request(`/api/appointments/lookup?code=${booked.body.code}&phone=8095550199`);assert.equal(lookup.res.status,200);assert.equal(lookup.body.appointment.payment_status,'pending');
});

test('integración: el dueño confirma la transferencia y la reserva llega a QFlow',async()=>{
  const owner=await login('dueno@barberia.local','Dueno123!');assert.equal(owner.body.user.role,'shop_owner');
  const dashboard=await request('/api/owner/dashboard',{cookie:owner.cookie});const appointment=dashboard.body.appointments[0];assert.equal(appointment.status,'awaiting_confirmation');
  const confirmed=await request(`/api/owner/appointments/${appointment.id}`,{cookie:owner.cookie,method:'PATCH',body:JSON.stringify({action:'confirm'})});assert.equal(confirmed.res.status,200);
  const barber=await login('barbero@barberia.local','Barbero123!');const queue=await request('/api/qflow',{cookie:barber.cookie});assert.equal(queue.body.appointments.length,1);assert.equal(queue.body.appointments[0].status,'confirmed');
  assert.equal((await request(`/api/qflow/${appointment.id}`,{cookie:barber.cookie,method:'PATCH',body:JSON.stringify({status:'in_service'})})).res.status,200);
  assert.equal((await request(`/api/qflow/${appointment.id}`,{cookie:barber.cookie,method:'PATCH',body:JSON.stringify({status:'completed'})})).res.status,200);
});

test('integración: impide dos reservas solapadas para el mismo barbero',async()=>{
  const ok=await request('/api/appointments',{method:'POST',body:JSON.stringify(booking(2,2,'10:00','Luis Díaz','8095550111'))});assert.equal(ok.res.status,201);
  const conflict=await request('/api/appointments',{method:'POST',body:JSON.stringify(booking(2,1,'10:30','Mario Peña','8095550222'))});assert.equal(conflict.res.status,409);assert.match(conflict.body.error,/reservado/);
});

test('integración: solo el dueño de barbería accede a su panel',async()=>{
  const barber=await login('barbero@barberia.local','Barbero123!');assert.equal((await request('/api/owner/dashboard',{cookie:barber.cookie})).res.status,403);
  const owner=await login('dueno@barberia.local','Dueno123!');assert.equal((await request('/api/owner/dashboard',{cookie:owner.cookie})).res.status,200);
});

test('integración: el dueño de plataforma administra barberías y roles',async()=>{
  const platform=await login('plataforma@barberia.local','Plataforma123!');assert.equal(platform.body.user.role,'platform_owner');
  const shop=await request('/api/platform/shops',{cookie:platform.cookie,method:'POST',body:JSON.stringify({name:'Barbería Norte',slug:'barberia-norte',address:'Av. Norte 10',phone:'8095550303',transferBank:'BHD',transferAccount:'100200300',transferHolder:'Barbería Norte SRL'})});assert.equal(shop.res.status,201);
  const user=await request('/api/platform/users',{cookie:platform.cookie,method:'POST',body:JSON.stringify({shopId:shop.body.id,name:'Dueña Norte',email:'duena@norte.local',password:'Segura123',role:'shop_owner'})});assert.equal(user.res.status,201);
  const dashboard=await request('/api/platform/dashboard',{cookie:platform.cookie});assert.ok(dashboard.body.shops.some(x=>x.name==='Barbería Norte'));assert.ok(dashboard.body.users.some(x=>x.email==='duena@norte.local'));
});
