import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

let server, base;
test.before(() => new Promise(resolve => {
  ({ server } = createApp({ db:createDatabase(':memory:') }));
  server.listen(0, '127.0.0.1', () => { base=`http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => new Promise(resolve => server.close(resolve)));

async function request(path,{cookie,...options}={}){
  const res=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(options.headers||{})}});
  const body=await res.json();return {res,body,cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
async function login(email,password){return request('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})})}

test('flujo completo: registrar, autenticar, reservar y pagar', async () => {
  const created=await request('/api/auth/register',{method:'POST',body:JSON.stringify({name:'Ana Pérez',email:'ana@example.com',phone:'8095550199',password:'Segura123'})});
  assert.equal(created.res.status,201);
  const auth=await login('ana@example.com','Segura123');assert.equal(auth.res.status,200);assert.equal(auth.body.user.role,'client');
  const available=await request('/api/availability?barberId=1&serviceId=1&date=2030-10-21');assert.equal(available.res.status,200);assert.ok(available.body.slots.includes('09:00'));
  const booked=await request('/api/appointments',{cookie:auth.cookie,method:'POST',body:JSON.stringify({barberId:1,serviceId:1,date:'2030-10-21',startTime:'09:00'})});assert.equal(booked.res.status,201);
  const payment=await request(`/api/appointments/${booked.body.id}/payment`,{cookie:auth.cookie,method:'POST',body:JSON.stringify({method:'card_demo'})});assert.equal(payment.res.status,201);assert.equal(payment.body.status,'paid');
  const history=await request('/api/appointments',{cookie:auth.cookie});assert.equal(history.body.appointments.length,1);assert.equal(history.body.appointments[0].payment_status,'paid');
});

test('integración: impide dos reservas para el mismo barbero y horario', async () => {
  const first=await login('cliente@cortecentral.do','Cliente123!');
  const ok=await request('/api/appointments',{cookie:first.cookie,method:'POST',body:JSON.stringify({barberId:2,serviceId:2,date:'2030-10-21',startTime:'10:00'})});assert.equal(ok.res.status,201);
  await request('/api/auth/register',{method:'POST',body:JSON.stringify({name:'Otro Cliente',email:'otro@example.com',password:'Segura123'})});
  const second=await login('otro@example.com','Segura123');
  const conflict=await request('/api/appointments',{cookie:second.cookie,method:'POST',body:JSON.stringify({barberId:2,serviceId:1,date:'2030-10-21',startTime:'10:30'})});
  assert.equal(conflict.res.status,409);assert.match(conflict.body.error,/reservado/);
});

test('integración: el panel administrativo exige el rol correcto', async () => {
  const client=await login('cliente@cortecentral.do','Cliente123!');
  assert.equal((await request('/api/admin/dashboard',{cookie:client.cookie})).res.status,403);
  const admin=await login('admin@cortecentral.do','Admin123!');
  const dashboard=await request('/api/admin/dashboard',{cookie:admin.cookie});assert.equal(dashboard.res.status,200);assert.ok(dashboard.body.counts.clients>=1);
});
