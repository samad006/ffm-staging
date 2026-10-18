(() => {
 'use strict';
 const form=document.querySelector('#assessment-form');
 if(!form || form.dataset.integration!=='demo') return;
 const msg=JSON.parse(form.dataset.formMessages), button=form.querySelector('button[type=submit]');
 const status=document.querySelector('#form-status'), summary=document.querySelector('#form-errors');
 const fields=['name','company','email','phone','facility','location','service','message'];
 let token='',pending=false,accepted=false,attemptKey='',attemptBody='',renewed=false;
 const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const announce=(text,focus=false)=>{status.textContent=text;if(focus)status.focus();};
 const clearErrors=()=>{summary.hidden=true;summary.replaceChildren();form.querySelectorAll('.form-field-error').forEach(e=>e.remove());fields.forEach(name=>{const field=form.elements.namedItem(name);field.removeAttribute('aria-invalid');field.removeAttribute('aria-describedby');field.setCustomValidity('');});};
 const showErrors=errors=>{
  clearErrors(); const heading=document.createElement('p');heading.textContent=msg.validation_summary;summary.append(heading);
  const list=document.createElement('ul');
  Object.entries(errors).forEach(([name,code])=>{if(!fields.includes(name))return;const field=form.elements.namedItem(name),error=document.createElement('span');
   error.id=field.id+'-error';error.className='form-field-error';error.textContent=msg[code]||msg.invalid;error.setAttribute('aria-hidden','true');
   field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',error.id);field.closest('label').append(error);
   const item=document.createElement('li'),link=document.createElement('a');link.href='#'+field.id;
   link.textContent=msg['field_'+name]+': '+error.textContent;link.addEventListener('click',()=>field.focus());item.append(link);list.append(item);
  });
  summary.append(list);summary.hidden=false;summary.focus();
 };
 async function request(path,options={}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try {const response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const data=await response.json();return {response,data};
  } finally {clearTimeout(timer);}
 }
 async function getSession(){const {response,data}=await request('/api/inquiry-session');if(!response.ok||!data.enabled||data.mode!=='demo'||!data.token)throw new Error('unavailable');token=data.token;}
 form.noValidate=true;
 button.disabled=true;announce(msg.connecting);
 getSession().then(()=>{button.disabled=false;announce(msg.ready);}).catch(()=>announce(msg.unavailable));
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(pending||accepted||!token)return;clearErrors();
  const payload={language:document.documentElement.lang,website:form.elements.namedItem('website').value},errors={};
  fields.forEach(name=>{const field=form.elements.namedItem(name);payload[name]=field.value.trim();
   if(field.required&&!payload[name])errors[name]='required';
   else if(field.type==='email'&&field.validity.typeMismatch)errors[name]='email';
   else if(field.maxLength>0&&[...payload[name]].length>field.maxLength)errors[name]='too_long';
  });
  if(Object.keys(errors).length){announce('');showErrors(errors);return;}
  const body=JSON.stringify(payload);
  if(body!==attemptBody){attemptBody=body;attemptKey=uid();renewed=false;}
  pending=true;button.disabled=true;form.setAttribute('aria-busy','true');
  // Freeze fields until the response settles; no edits can race acceptance.
  fields.forEach(name=>{form.elements.namedItem(name).disabled=true;});announce(msg.sending);
  try {
   let result=await request('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json','X-FFM-Token':token,'Idempotency-Key':attemptKey},body});
   if(result.response.status===419&&!renewed){renewed=true;await getSession();result=await request('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json','X-FFM-Token':token,'Idempotency-Key':attemptKey},body});}
   const {response,data}=result;
   if(response.ok&&data.code==='accepted'&&data.mode==='demo'&&typeof data.reference==='string'&&data.reference.startsWith('DEMO-')){
    accepted=true;form.reset();attemptBody='';attemptKey='';token='';announce(msg.success+' '+msg.reference+' '+data.reference,true);button.textContent=msg.accepted;
   } else if(data.code==='validation'){announce('');showErrors(data.fields||{});}
   else announce(msg[data.code]||msg.unavailable,true);
  } catch {announce(msg.network_error,true);}
  finally {pending=false;form.removeAttribute('aria-busy');fields.forEach(name=>{form.elements.namedItem(name).disabled=false;});button.disabled=accepted;}
 });
})();
