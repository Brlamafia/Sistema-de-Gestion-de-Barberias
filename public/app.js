const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>[...root.querySelectorAll(s)];
const state={user:null,shops:[],shop:null,services:[],barbers:[],selectedTime:null,owner:null,platform:null,managedShopId:null};
const money=c=>new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP',maximumFractionDigits:0}).format(c/100);
const dateText=d=>new Intl.DateTimeFormat('es-DO',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${d}T12:00:00`));
const statusText={awaiting_confirmation:'Pendiente de confirmación',confirmed:'Confirmada',in_service:'En servicio',completed:'Completada',cancelled:'Cancelada',rejected:'Rechazada',pending:'Transferencia pendiente',verified:'Transferencia verificada',refunded:'Reembolsada'};
async function api(path,options={}){const res=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options}),data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'No fue posible completar la solicitud.');return data;}
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.className=`toast show${error?' error':''}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className='toast',4200);}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function table(head,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${head.length}">Sin registros.</td></tr>`}</tbody></table></div>`;}

async function init(){
  $('#dateInput').min=today();$('#dateInput').value=today();
  const [shops,me]=await Promise.all([api('/api/shops'),api('/api/me')]);state.shops=shops.shops;state.user=me.user;
  $('#shopSelect').innerHTML='<option value="">Selecciona una barbería</option>'+state.shops.map(s=>`<option value="${s.id}">${escapeHtml(s.name)} · ${escapeHtml(s.address)}</option>`).join('');
  if(state.shops[0]){$('#shopSelect').value=state.shops[0].id;await loadCatalog();}
  renderUser();
}
async function loadCatalog(){
  const id=$('#shopSelect').value;state.selectedTime=null;if(!id)return;
  const data=await api(`/api/catalog?shopId=${id}`);state.shop=data.shop;state.services=data.services;state.barbers=data.barbers;
  $('#serviceGrid').innerHTML=state.services.map((s,i)=>`<article class="service-card"><div class="service-index">${String(i+1).padStart(2,'0')}</div><div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description)}</p></div><div class="service-meta"><b>${money(s.price_cents)}</b><span>${s.duration_minutes} min</span></div></article>`).join('');
  $('#serviceSelect').innerHTML='<option value="">Selecciona un servicio</option>'+state.services.map(s=>`<option value="${s.id}">${escapeHtml(s.name)} · ${money(s.price_cents)}</option>`).join('');
  $('#barberSelect').innerHTML='<option value="">Selecciona un barbero</option>'+state.barbers.map(b=>`<option value="${b.id}">${escapeHtml(b.name)} · ${escapeHtml(b.specialty||'Barbero')}</option>`).join('');
  $('#transferInfo').innerHTML=`<strong>Transferencia para ${escapeHtml(state.shop.name)}</strong><br>${escapeHtml(state.shop.transfer_bank)} · Cuenta ${escapeHtml(state.shop.transfer_account)}<br>A nombre de ${escapeHtml(state.shop.transfer_holder)}`;
  loadSlots();
}
async function loadSlots(){
  const shopId=$('#shopSelect').value,barberId=$('#barberSelect').value,serviceId=$('#serviceSelect').value,date=$('#dateInput').value;state.selectedTime=null;
  if(!shopId||!barberId||!serviceId||!date){$('#slots').className='slots empty';$('#slots').textContent='Selecciona barbería, servicio, barbero y fecha.';return;}
  try{const {slots}=await api(`/api/availability?shopId=${shopId}&barberId=${barberId}&serviceId=${serviceId}&date=${date}`);$('#slots').className=`slots${slots.length?'':' empty'}`;$('#slots').innerHTML=slots.length?slots.map(t=>`<button class="slot" type="button" data-time="${t}">${t}</button>`).join(''):'No quedan horarios disponibles para esta fecha.';}catch(e){toast(e.message,true);}
}
async function book(e){
  e.preventDefault();if(!state.selectedTime)return toast('Selecciona un horario disponible.',true);
  const body={shopId:Number($('#shopSelect').value),serviceId:Number($('#serviceSelect').value),barberId:Number($('#barberSelect').value),date:$('#dateInput').value,startTime:state.selectedTime,guestName:$('#guestName').value,guestPhone:$('#guestPhone').value,guestEmail:$('#guestEmail').value,transferReference:$('#transferReference').value,notes:$('#notesInput').value};
  try{const r=await api('/api/appointments',{method:'POST',body:JSON.stringify(body)});toast(`Reserva recibida. Tu código es ${r.code}.`);$('#transferReference').value='';$('#notesInput').value='';state.selectedTime=null;await loadSlots();$('#lookupResult').innerHTML=`<article class="account-card"><div><span class="status awaiting_confirmation">Pendiente de confirmación</span><h3>Código ${r.code}</h3><p>Conserva este código y tu teléfono para consultar el estado.</p></div></article>`;}catch(err){toast(err.message,true);await loadSlots();}
}
function renderUser(){
  $('.nav-login').classList.toggle('hidden',!!state.user);$('#userButton').classList.toggle('hidden',!state.user);
  if(!state.user){$('#accountSection').classList.add('hidden');return;}
  $('#userButton').textContent=state.user.name.split(' ')[0];$('#accountSection').classList.remove('hidden');
  if(state.user.role==='shop_owner')loadOwner();else if(state.user.role==='platform_owner')loadPlatform();else loadQFlow();
}
async function loadOwner(shopId=null){
  const selected=shopId||state.managedShopId,query=selected?`?shopId=${selected}`:'';state.owner=await api(`/api/owner/dashboard${query}`);state.managedShopId=state.owner.shop.id;
  $('#accountEyebrow').textContent=state.user.role==='platform_owner'?'Administración delegada':'Dueño de la barbería';$('#accountTitle').textContent=`Gestión de ${state.owner.shop.name}`;renderOwner('appointments');
}
function renderOwner(tab){
  const d=state.owner;$('#accountContent').innerHTML=`${state.user.role==='platform_owner'?'<button class="mini" data-action="back-platform">Volver a plataforma</button>':''}<div class="admin-metrics"><div class="metric"><span>Reservas</span><b>${d.counts.appointments}</b></div><div class="metric"><span>Por confirmar</span><b>${d.counts.awaiting}</b></div><div class="metric"><span>En QFlow</span><b>${d.counts.confirmed}</b></div><div class="metric"><span>Transferencias</span><b>${money(d.counts.revenue_cents)}</b></div></div><div class="admin-tabs"><button data-owner-tab="appointments">Confirmaciones</button><button data-owner-tab="services">Servicios</button><button data-owner-tab="barbers">Barberos y horarios</button><button data-owner-tab="payments">Transferencias</button></div><div id="adminPanel"></div>`;
  $$('[data-owner-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ownerTab===tab));renderOwnerPanel(tab);
}
function renderOwnerPanel(tab){
  const d=state.owner,p=$('#adminPanel'),shopField=state.user.role==='platform_owner'?`<input type="hidden" name="shopId" value="${d.shop.id}">`:'';
  if(tab==='appointments')p.innerHTML=table(['Cliente','Servicio','Barbero','Fecha','Transferencia','Acción'],d.appointments.map(a=>[escapeHtml(a.guest_name),escapeHtml(a.service_name),escapeHtml(a.barber_name),`${a.appointment_date} ${a.start_time}`,`${escapeHtml(a.transfer_reference)} · ${statusText[a.payment_status]}`,a.status==='awaiting_confirmation'?`<button class="mini" data-owner-action="confirm" data-id="${a.id}">Confirmar</button> <button class="mini" data-owner-action="reject" data-id="${a.id}">Rechazar</button>`:`<span class="status ${a.status}">${statusText[a.status]}</span>`]));
  if(tab==='services')p.innerHTML=`<form class="inline-form" id="serviceOwnerForm">${shopField}<input name="name" placeholder="Servicio" required><input name="description" placeholder="Descripción" required><input name="price" type="number" min="0" placeholder="Precio RD$" required><input name="duration" type="number" min="15" step="15" placeholder="Minutos" required><button class="button primary">Agregar</button></form>`+table(['Servicio','Precio','Duración','Estado'],d.services.map(s=>[s.name,money(s.price_cents),`${s.duration_minutes} min`,s.active?'Activo':'Inactivo']));
  if(tab==='barbers')p.innerHTML=`<form class="inline-form" id="barberOwnerForm">${shopField}<input name="name" placeholder="Nombre" required><input name="specialty" placeholder="Especialidad"><span></span><span></span><button class="button primary">Agregar</button></form><form class="inline-form" id="scheduleOwnerForm">${shopField}<select name="barberId">${d.barbers.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`)}</select><select name="weekday">${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((x,i)=>`<option value="${i}">${x}</option>`)}</select><input name="startTime" type="time" value="09:00"><input name="endTime" type="time" value="18:00"><button class="button primary">Guardar horario</button></form>`+table(['Barbero','Especialidad','Estado'],d.barbers.map(b=>[b.name,b.specialty||'',b.active?'Activo':'Inactivo']));
  if(tab==='payments')p.innerHTML=table(['Cliente','Referencia','Monto','Estado','Fecha'],d.payments.map(a=>[a.guest_name,a.transfer_reference,money(a.price_cents),statusText[a.payment_status],a.appointment_date]));
}
async function loadQFlow(){
  const {appointments}=await api('/api/qflow');$('#accountEyebrow').textContent='QFlow';$('#accountTitle').textContent='Cola de trabajo';
  $('#accountContent').innerHTML=appointments.length?`<div class="qflow-grid">${appointments.map((a,i)=>`<article class="account-card qflow-card"><div><span class="queue-number">${String(i+1).padStart(2,'0')}</span><span class="status ${a.status}">${statusText[a.status]}</span><h3>${escapeHtml(a.guest_name)}</h3><p>${escapeHtml(a.service_name)} · ${a.start_time}</p><p>${escapeHtml(a.guest_phone)} ${a.notes?'· '+escapeHtml(a.notes):''}</p></div><button class="button ${a.status==='confirmed'?'primary':'ghost'}" data-qflow="${a.status==='confirmed'?'in_service':'completed'}" data-id="${a.id}">${a.status==='confirmed'?'Iniciar servicio':'Completar'}</button></article>`).join('')}</div>`:'<p>No hay reservas confirmadas en la cola.</p>';
}
async function loadPlatform(){state.platform=await api('/api/platform/dashboard');$('#accountEyebrow').textContent='Dueño de la plataforma';$('#accountTitle').textContent='Administración global';renderPlatform('shops');}
function renderPlatform(tab){const d=state.platform;$('#accountContent').innerHTML=`<div class="admin-metrics"><div class="metric"><span>Barberías</span><b>${d.shops.length}</b></div><div class="metric"><span>Activas</span><b>${d.shops.filter(x=>x.active).length}</b></div><div class="metric"><span>Usuarios internos</span><b>${d.users.length}</b></div><div class="metric"><span>Reservas</span><b>${d.appointments.length}</b></div></div><div class="admin-tabs"><button data-platform-tab="shops">Barberías</button><button data-platform-tab="users">Roles y usuarios</button><button data-platform-tab="appointments">Todas las reservas</button></div><div id="adminPanel"></div>`;$$('[data-platform-tab]').forEach(b=>b.classList.toggle('active',b.dataset.platformTab===tab));renderPlatformPanel(tab);}
function renderPlatformPanel(tab){
  const d=state.platform,p=$('#adminPanel');
  if(tab==='shops')p.innerHTML=`<form class="platform-form" id="shopPlatformForm"><input name="name" placeholder="Nombre de la barbería" required><input name="slug" placeholder="identificador-web" required><input name="address" placeholder="Dirección" required><input name="phone" placeholder="Teléfono"><input name="transferBank" placeholder="Banco" required><input name="transferAccount" placeholder="Cuenta" required><input name="transferHolder" placeholder="Titular" required><button class="button primary">Agregar barbería</button></form>`+table(['Barbería','Personal','Reservas','Estado','Gestión'],d.shops.map(s=>[s.name,s.staff_count,s.appointment_count,`<button class="mini" data-toggle-shop="${s.id}" data-active="${s.active}">${s.active?'Activa':'Inactiva'}</button>`,`<button class="mini" data-manage-shop="${s.id}">Administrar</button>`]));
  if(tab==='users')p.innerHTML=`<form class="platform-form" id="userPlatformForm"><input name="name" placeholder="Nombre" required><input name="email" type="email" placeholder="Correo" required><input name="phone" placeholder="Teléfono"><select name="role"><option value="shop_owner">Dueño de barbería</option><option value="barber">Barbero</option><option value="platform_owner">Dueño de plataforma</option></select><select name="shopId"><option value="">Sin barbería</option>${d.shops.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`)}</select><input name="specialty" placeholder="Especialidad si es barbero"><input name="password" type="password" placeholder="Contraseña segura" required><button class="button primary">Crear usuario</button></form>`+table(['Nombre','Correo','Rol','Barbería','Estado'],d.users.map(u=>[u.name,u.email,u.role,u.shop_name||'Plataforma',u.active?'Activo':'Inactivo']));
  if(tab==='appointments')p.innerHTML=table(['Barbería','Cliente','Servicio','Barbero','Fecha','Estado'],d.appointments.map(a=>[a.shop_name,a.guest_name,a.service_name,a.barber_name,`${a.appointment_date} ${a.start_time}`,statusText[a.status]]));
}

document.addEventListener('click',async e=>{
  const action=e.target.dataset.action;if(action==='open-auth')$('#authDialog').showModal();if(action==='close-auth')$('#authDialog').close();if(action==='logout'){await api('/api/auth/logout',{method:'POST'});state.user=null;renderUser();toast('Sesión cerrada.');}
  if(action==='back-platform')loadPlatform();
  if(e.target.matches('.slot')){$$('.slot').forEach(x=>x.classList.remove('selected'));e.target.classList.add('selected');state.selectedTime=e.target.dataset.time;}
  if(e.target.dataset.ownerTab)renderOwner(e.target.dataset.ownerTab);if(e.target.dataset.platformTab)renderPlatform(e.target.dataset.platformTab);
  if(e.target.dataset.ownerAction){try{await api(`/api/owner/appointments/${e.target.dataset.id}`,{method:'PATCH',body:JSON.stringify({action:e.target.dataset.ownerAction,shopId:state.managedShopId})});toast(e.target.dataset.ownerAction==='confirm'?'Reserva confirmada y enviada a QFlow.':'Reserva rechazada.');loadOwner();}catch(err){toast(err.message,true);}}
  if(e.target.dataset.qflow){try{await api(`/api/qflow/${e.target.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:e.target.dataset.qflow})});toast('QFlow actualizado.');loadQFlow();}catch(err){toast(err.message,true);}}
  if(e.target.dataset.manageShop)loadOwner(Number(e.target.dataset.manageShop));
  if(e.target.dataset.toggleShop){try{await api(`/api/platform/shops/${e.target.dataset.toggleShop}`,{method:'PATCH',body:JSON.stringify({active:!Number(e.target.dataset.active)})});toast('Estado de la barbería actualizado.');loadPlatform();}catch(err){toast(err.message,true);}}
  if(e.target.id==='menuButton'){const nav=$('#nav');nav.classList.toggle('open');e.target.setAttribute('aria-expanded',nav.classList.contains('open'));}
});
document.addEventListener('change',e=>{if(e.target.id==='shopSelect')loadCatalog();if(['serviceSelect','barberSelect','dateInput'].includes(e.target.id))loadSlots();});
document.addEventListener('submit',async e=>{
  if(e.target.id==='bookingForm')return book(e);e.preventDefault();
  try{
    if(e.target.id==='lookupForm'){const b=Object.fromEntries(new FormData(e.target)),r=await api(`/api/appointments/lookup?code=${encodeURIComponent(b.code)}&phone=${encodeURIComponent(b.phone)}`),a=r.appointment;$('#lookupResult').innerHTML=`<article class="account-card"><div><span class="status ${a.status}">${statusText[a.status]}</span><h3>${escapeHtml(a.service_name)} con ${escapeHtml(a.barber_name)}</h3><p>${dateText(a.appointment_date)} · ${a.start_time}</p><p>${escapeHtml(a.shop_name)} · ${statusText[a.payment_status]}</p></div></article>`;}
    if(e.target.id==='loginForm'){const b=Object.fromEntries(new FormData(e.target)),r=await api('/api/auth/login',{method:'POST',body:JSON.stringify(b)});state.user=r.user;$('#authDialog').close();renderUser();toast(`Hola, ${r.user.name}.`);}
    if(e.target.id==='serviceOwnerForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/owner/services',{method:'POST',body:JSON.stringify({shopId:Number(b.shopId)||undefined,name:b.name,description:b.description,priceCents:Math.round(Number(b.price)*100),durationMinutes:Number(b.duration)})});toast('Servicio creado.');loadOwner();}
    if(e.target.id==='barberOwnerForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/owner/barbers',{method:'POST',body:JSON.stringify({...b,shopId:Number(b.shopId)||undefined})});toast('Barbero creado.');loadOwner();}
    if(e.target.id==='scheduleOwnerForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/owner/schedules',{method:'POST',body:JSON.stringify({...b,shopId:Number(b.shopId)||undefined,barberId:Number(b.barberId),weekday:Number(b.weekday)})});toast('Horario guardado.');loadOwner();}
    if(e.target.id==='shopPlatformForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/platform/shops',{method:'POST',body:JSON.stringify(b)});toast('Barbería agregada.');loadPlatform();}
    if(e.target.id==='userPlatformForm'){const b=Object.fromEntries(new FormData(e.target));await api('/api/platform/users',{method:'POST',body:JSON.stringify({...b,shopId:Number(b.shopId)||undefined})});toast('Usuario y rol creados.');loadPlatform();}
  }catch(err){toast(err.message,true);}
});
init().catch(e=>toast(e.message,true));
