const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = { user:null, services:[], barbers:[], selectedTime:null, admin:null };
const money = cents => new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP',maximumFractionDigits:0}).format(cents/100);
const dateText = d => new Intl.DateTimeFormat('es-DO',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${d}T12:00:00`));
const statusText = {scheduled:'Agendada',confirmed:'Confirmada',completed:'Completada',cancelled:'Cancelada',pending:'Pendiente',paid:'Pagado',refunded:'Reembolsado',failed:'Fallido',unpaid:'Sin pago'};

async function api(path, options={}) {
  const res = await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'No fue posible completar la solicitud.');
  return data;
}
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.className=`toast show${error?' error':''}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className='toast',3200)}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}

async function init(){
  $('#dateInput').min=today(); $('#dateInput').value=today();
  const [services,barbers,me]=await Promise.all([api('/api/services'),api('/api/barbers'),api('/api/me')]);
  state.services=services.services;state.barbers=barbers.barbers;state.user=me.user;
  renderServices(); fillSelects(); renderUser();
}
function renderServices(){
  $('#serviceGrid').innerHTML=state.services.map((s,i)=>`<article class="service-card"><div class="service-index">${String(i+1).padStart(2,'0')}</div><div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description)}</p></div><div class="service-meta"><b>${money(s.price_cents)}</b><span>${s.duration_minutes} min</span></div></article>`).join('');
}
function fillSelects(){
  $('#serviceSelect').innerHTML='<option value="">Selecciona un servicio</option>'+state.services.map(s=>`<option value="${s.id}">${escapeHtml(s.name)} · ${money(s.price_cents)}</option>`).join('');
  $('#barberSelect').innerHTML='<option value="">Selecciona un barbero</option>'+state.barbers.map(b=>`<option value="${b.id}">${escapeHtml(b.name)} · ${escapeHtml(b.specialty||'Barbero')}</option>`).join('');
}
function renderUser(){
  $('.nav-login').classList.toggle('hidden',!!state.user);$('#userButton').classList.toggle('hidden',!state.user);
  if(!state.user){$('#accountSection').classList.add('hidden');return}
  $('#userButton').textContent=state.user.name.split(' ')[0];$('#accountSection').classList.remove('hidden');
  if(state.user.role==='client') loadClient(); else if(state.user.role==='admin') loadAdmin(); else loadBarber();
}
async function loadSlots(){
  const barberId=$('#barberSelect').value,serviceId=$('#serviceSelect').value,date=$('#dateInput').value;state.selectedTime=null;
  if(!barberId||!serviceId||!date){$('#slots').className='slots empty';$('#slots').textContent='Selecciona servicio, barbero y fecha.';return}
  try{const {slots}=await api(`/api/availability?barberId=${barberId}&serviceId=${serviceId}&date=${date}`);$('#slots').className=`slots${slots.length?'':' empty'}`;$('#slots').innerHTML=slots.length?slots.map(t=>`<button class="slot" type="button" data-time="${t}">${t}</button>`).join(''):'No quedan horarios disponibles para esta fecha.';}catch(e){toast(e.message,true)}
}
async function book(e){e.preventDefault();if(!state.user){$('#authDialog').showModal();return}if(state.user.role!=='client')return toast('Las reservas se crean desde una cuenta de cliente.',true);if(!state.selectedTime)return toast('Selecciona un horario disponible.',true);
  try{await api('/api/appointments',{method:'POST',body:JSON.stringify({serviceId:Number($('#serviceSelect').value),barberId:Number($('#barberSelect').value),date:$('#dateInput').value,startTime:state.selectedTime,notes:$('#notesInput').value})});toast('Cita reservada correctamente.');e.target.reset();$('#dateInput').value=today();loadSlots();loadClient();}catch(err){toast(err.message,true);loadSlots()}
}
async function loadClient(){
  $('#accountTitle').textContent='Mis citas'; const {appointments}=await api('/api/appointments');
  $('#accountContent').innerHTML=appointments.length?appointments.map(a=>`<article class="account-card"><div><span class="status ${a.status}">${statusText[a.status]}</span><h3>${escapeHtml(a.service_name)} con ${escapeHtml(a.barber_name)}</h3><p>${dateText(a.appointment_date)} · ${a.start_time} - ${a.end_time}</p><p>Pago: ${statusText[a.payment_status]} · ${money(a.price_cents)}</p></div><div class="card-actions">${a.status!=='cancelled'&&a.status!=='completed'?`<button class="mini" data-reschedule="${a.id}" data-barber="${a.barber_id}" data-service="${a.service_id}">Reprogramar</button><button class="mini" data-cancel="${a.id}">Cancelar</button>`:''}${a.payment_status==='unpaid'&&a.status!=='cancelled'?`<button class="mini" data-pay="${a.id}">Pagar</button>`:''}</div></article>`).join(''):'<p>Aún no tienes citas. Elige un servicio para reservar.</p>';
}
async function loadBarber(){const {appointments}=await api('/api/barber/appointments');$('#accountTitle').textContent='Mi agenda';$('#accountContent').innerHTML=appointments.length?appointments.map(a=>`<article class="account-card"><div><span class="status ${a.status}">${statusText[a.status]}</span><h3>${dateText(a.appointment_date)} · ${a.start_time}</h3><p>${escapeHtml(a.client_name)} · ${escapeHtml(a.service_name)}</p></div></article>`).join(''):'<p>No hay citas asignadas.</p>'}
async function loadAdmin(){
  $('#accountTitle').textContent='Panel administrativo'; const [dash,services,barbers]=await Promise.all([api('/api/admin/dashboard'),api('/api/admin/services'),api('/api/admin/barbers')]);state.admin={...dash,...services,...barbers};renderAdmin('appointments');
}
function renderAdmin(tab){const d=state.admin;$('#accountContent').innerHTML=`<div class="admin-metrics"><div class="metric"><span>Clientes</span><b>${d.counts.clients}</b></div><div class="metric"><span>Citas</span><b>${d.counts.appointments}</b></div><div class="metric"><span>Por atender</span><b>${d.counts.pending}</b></div><div class="metric"><span>Ingresos pagados</span><b>${money(d.counts.revenue_cents)}</b></div></div><div class="admin-tabs"><button data-admin-tab="appointments">Citas</button><button data-admin-tab="services">Servicios</button><button data-admin-tab="barbers">Barberos y horarios</button><button data-admin-tab="payments">Pagos</button><button data-admin-tab="clients">Clientes</button></div><div id="adminPanel"></div>`;$$('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===tab));renderAdminPanel(tab)}
function renderAdminPanel(tab){const d=state.admin,p=$('#adminPanel');
  if(tab==='appointments')p.innerHTML=table(['Cliente','Servicio','Barbero','Fecha','Estado'],d.appointments.map(a=>[a.client_name,a.service_name,a.barber_name,`${a.appointment_date} ${a.start_time}`,`<select data-appointment-status="${a.id}">${['scheduled','confirmed','completed','cancelled'].map(x=>`<option value="${x}" ${x===a.status?'selected':''}>${statusText[x]}</option>`).join('')}</select>`]));
  if(tab==='services')p.innerHTML=`<form class="inline-form" id="serviceAdminForm"><input name="name" placeholder="Servicio" required><input name="description" placeholder="Descripción" required><input name="price" type="number" min="0" placeholder="Precio RD$" required><input name="duration" type="number" min="15" step="15" placeholder="Minutos" required><button class="button primary">Agregar</button></form>`+table(['Servicio','Precio','Duración','Activo'],d.services.map(s=>[s.name,money(s.price_cents),`${s.duration_minutes} min`,`<button class="mini" data-toggle-service="${s.id}" data-active="${s.active}">${s.active?'Desactivar':'Activar'}</button>`]));
  if(tab==='barbers')p.innerHTML=`<form class="inline-form" id="barberAdminForm"><input name="name" placeholder="Nombre" required><input name="specialty" placeholder="Especialidad"><span></span><span></span><button class="button primary">Agregar</button></form><p>Para configurar un día, selecciona el barbero y guarda la jornada.</p><form class="inline-form" id="scheduleAdminForm"><select name="barberId">${d.barbers.map(b=>`<option value="${b.id}">${b.name}</option>`)}</select><select name="weekday">${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((x,i)=>`<option value="${i}">${x}</option>`)}</select><input name="startTime" type="time" value="09:00"><input name="endTime" type="time" value="18:00"><button class="button primary">Guardar</button></form>`+table(['Barbero','Especialidad','Estado'],d.barbers.map(b=>[b.name,b.specialty||'',b.active?'Activo':'Inactivo']));
  if(tab==='payments')p.innerHTML=table(['Cliente','Servicio','Monto','Método','Estado'],d.payments.map(x=>[x.client_name,x.service_name,money(x.amount_cents),x.method,`<select data-payment-status="${x.id}">${['pending','paid','refunded','failed'].map(s=>`<option value="${s}" ${s===x.status?'selected':''}>${statusText[s]}</option>`).join('')}</select>`]));
  if(tab==='clients')p.innerHTML=table(['Nombre','Correo','Teléfono','Alta'],d.clients.map(x=>[x.name,x.email,x.phone||'',x.created_at.slice(0,10)]));
}
function table(head,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

document.addEventListener('click',async e=>{
  const action=e.target.dataset.action;if(action==='open-auth')$('#authDialog').showModal();if(action==='close-auth')$('#authDialog').close();if(action==='logout'){await api('/api/auth/logout',{method:'POST'});state.user=null;renderUser();toast('Sesión cerrada.');}
  if(e.target.matches('.slot')){$$('.slot').forEach(x=>x.classList.remove('selected'));e.target.classList.add('selected');state.selectedTime=e.target.dataset.time}
  if(e.target.dataset.cancel){if(!confirm('¿Cancelar esta cita?'))return;try{await api(`/api/appointments/${e.target.dataset.cancel}`,{method:'PATCH',body:JSON.stringify({action:'cancel'})});toast('Cita cancelada.');loadClient()}catch(err){toast(err.message,true)}}
  if(e.target.dataset.pay){const method=prompt('Método: cash, transfer o card_demo','card_demo');if(!method)return;try{const r=await api(`/api/appointments/${e.target.dataset.pay}/payment`,{method:'POST',body:JSON.stringify({method})});toast(r.message);loadClient()}catch(err){toast(err.message,true)}}
  if(e.target.dataset.reschedule){const date=prompt('Nueva fecha (AAAA-MM-DD)',today());const startTime=prompt('Nueva hora (HH:MM)','10:00');if(!date||!startTime)return;try{await api(`/api/appointments/${e.target.dataset.reschedule}`,{method:'PATCH',body:JSON.stringify({action:'reschedule',date,startTime})});toast('Cita reprogramada.');loadClient()}catch(err){toast(err.message,true)}}
  if(e.target.dataset.adminTab)renderAdmin(e.target.dataset.adminTab);
  if(e.target.dataset.toggleService){try{await api(`/api/admin/services/${e.target.dataset.toggleService}`,{method:'PATCH',body:JSON.stringify({active:!Number(e.target.dataset.active)})});toast('Servicio actualizado.');loadAdmin()}catch(err){toast(err.message,true)}}
  if(e.target.id==='menuButton'){const nav=$('#nav');nav.classList.toggle('open');e.target.setAttribute('aria-expanded',nav.classList.contains('open'))}
});
document.addEventListener('change',async e=>{
  if(['serviceSelect','barberSelect','dateInput'].includes(e.target.id))loadSlots();
  if(e.target.dataset.appointmentStatus){try{await api(`/api/admin/appointments/${e.target.dataset.appointmentStatus}`,{method:'PATCH',body:JSON.stringify({status:e.target.value})});toast('Estado actualizado.')}catch(err){toast(err.message,true)}}
  if(e.target.dataset.paymentStatus){try{await api(`/api/admin/payments/${e.target.dataset.paymentStatus}`,{method:'PATCH',body:JSON.stringify({status:e.target.value})});toast('Pago actualizado.')}catch(err){toast(err.message,true)}}
});
document.addEventListener('submit',async e=>{
  if(e.target.id==='bookingForm')return book(e);e.preventDefault();
  try{
    if(e.target.id==='loginForm'){const b=Object.fromEntries(new FormData(e.target));const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify(b)});state.user=r.user;$('#authDialog').close();renderUser();toast(`Hola, ${r.user.name}.`)}
    if(e.target.id==='registerForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/auth/register',{method:'POST',body:JSON.stringify(b)});toast('Cuenta creada. Inicia sesión.');$('[data-auth="login"]').click()}
    if(e.target.id==='serviceAdminForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/admin/services',{method:'POST',body:JSON.stringify({name:b.name,description:b.description,priceCents:Math.round(Number(b.price)*100),durationMinutes:Number(b.duration)})});toast('Servicio creado.');loadAdmin()}
    if(e.target.id==='barberAdminForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/admin/barbers',{method:'POST',body:JSON.stringify(b)});toast('Barbero creado.');loadAdmin()}
    if(e.target.id==='scheduleAdminForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/admin/schedules',{method:'POST',body:JSON.stringify({...b,barberId:Number(b.barberId),weekday:Number(b.weekday)})});toast('Horario guardado.');loadAdmin()}
  }catch(err){toast(err.message,true)}
});
$$('[data-auth]').forEach(b=>b.addEventListener('click',()=>{$$('[data-auth]').forEach(x=>x.classList.toggle('active',x===b));$('#loginForm').classList.toggle('hidden',b.dataset.auth!=='login');$('#registerForm').classList.toggle('hidden',b.dataset.auth!=='register');$('#authTitle').textContent=b.dataset.auth==='login'?'Iniciar sesión':'Crear cuenta'}));
init().catch(e=>toast(e.message,true));
