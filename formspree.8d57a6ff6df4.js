(() => {
 'use strict';
 const form = document.querySelector('#assessment-form[data-integration="formspree"]');
 if (!form || form.dataset.initialized) return;
 const endpoint = 'https://formspree.io/f/mvkzyvre';
 if (form.getAttribute('action') !== endpoint) return;
 let msg;
 try { msg = JSON.parse(form.dataset.formMessages); } catch { return; }
 const button = form.querySelector('button[type="submit"]');
 const status = document.querySelector('#form-status'), summary = document.querySelector('#form-errors');
 const fields = ['name','company','email','phone','facility','location','service','message'];
 if (!button || !status || !summary || fields.some(name => !form.elements.namedItem(name))) return;
 form.dataset.initialized = 'true';
 const storageKey = 'ffm.formspree.acceptedAt', repeatWindow = 10 * 60 * 1000;
 const started = Date.now();
 let pending = false, accepted = false, lastAttempt = 0;
 const announce = (text, focus = false) => { status.textContent = text; if (focus) status.focus(); };
 function recentAcceptance() {
  try {
   const at = Number(sessionStorage.getItem(storageKey));
   return at > 0 && Date.now() >= at && Date.now() - at < repeatWindow;
  } catch { return false; }
 }
 function clearErrors() {
  summary.hidden = true; summary.replaceChildren();
  form.querySelectorAll('.form-field-error').forEach(node => node.remove());
  fields.forEach(name => {
   const field = form.elements.namedItem(name);
   field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); field.setCustomValidity('');
  });
 }
 function showErrors(errors) {
  clearErrors();
  const heading = document.createElement('p'), list = document.createElement('ul');
  heading.textContent = msg.validation_summary; summary.append(heading);
  Object.entries(errors).forEach(([name, code]) => {
   if (!fields.includes(name)) return;
   const field = form.elements.namedItem(name), error = document.createElement('span');
   error.id = field.id + '-error'; error.className = 'form-field-error'; error.textContent = msg[code] || msg.invalid;
   field.setAttribute('aria-invalid','true'); field.setAttribute('aria-describedby',error.id);
   field.closest('label').append(error);
   const item = document.createElement('li'), link = document.createElement('a');
   link.href = '#' + field.id; link.textContent = msg['field_' + name] + ': ' + error.textContent;
   link.addEventListener('click', () => field.focus()); item.append(link); list.append(item);
  });
  summary.append(list); summary.hidden = false; summary.focus();
 }
 function validate() {
  const payload = {}, errors = {};
  fields.forEach(name => {
   const field = form.elements.namedItem(name), value = field.value.normalize('NFC').trim();
   payload[name] = value;
   if (field.required && !value) errors[name] = 'required';
   else if (field.maxLength > 0 && [...value].length > field.maxLength) errors[name] = 'too_long';
   else if ((name === 'message' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/ : /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/).test(value)) errors[name] = 'invalid';
   else if (field.tagName === 'SELECT' && !Array.from(field.options).some(option => option.value === value)) errors[name] = 'invalid';
  });
  const email = payload.email;
  if (email && (!/^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email) || email.split('@')[0].length > 64 || email.split('@').pop().split('.').some(label => label.length > 63))) errors.email = 'email';
  if (payload.phone && !/^[\p{Nd}+(). /-]{3,40}$/u.test(payload.phone)) errors.phone = 'phone';
  return {payload, errors};
 }
 form.noValidate = true;
 accepted = recentAcceptance(); button.disabled = accepted;
 if (accepted) { button.textContent = msg.accepted; announce(msg.recently_sent); }
 form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending || accepted) return;
  if (recentAcceptance()) { accepted = true; button.disabled = true; announce(msg.recently_sent, true); return; }
  clearErrors(); announce('');
  const {payload, errors} = validate();
  if (Object.keys(errors).length) { showErrors(errors); return; }
  // The provider's documented honeypot is also sent; this browser check is bypassable.
  if (form.elements.namedItem('_gotcha').value) { announce(msg.rejected, true); return; }
  if (Date.now() - started < 2000 || (lastAttempt && Date.now() - lastAttempt < 3000)) { announce(msg.too_fast, true); return; }
  payload._gotcha = ''; payload.language = document.documentElement.lang;
  payload._subject = 'FFM — Facility inquiry / استفسار عن خدمات المرافق';
  // Include readable selection labels while retaining the original stable values.
  ['facility','service'].forEach(name => { payload[name + '_label'] = form.elements.namedItem(name).selectedOptions[0].textContent; });
  pending = true; lastAttempt = Date.now(); button.disabled = true; form.setAttribute('aria-busy','true');
  fields.forEach(name => { form.elements.namedItem(name).disabled = true; }); announce(msg.sending);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
   // No cookies, custom authorization, CSRF token or unsupported idempotency header.
   const response = await fetch(endpoint, {
    method: 'POST', headers: {'Accept':'application/json','Content-Type':'application/json'},
    body: JSON.stringify(payload), credentials: 'omit', mode: 'cors', cache: 'no-store',
    redirect: 'error', referrerPolicy: 'strict-origin-when-cross-origin', signal: controller.signal
   });
   let data;
   try { data = await response.json(); } catch { announce(msg.unconfirmed, true); return; }
   // Formspree's current client identifies acceptance by a JSON `next` string.
   // Also support its explicit `ok:true` response; never accept an arbitrary 2xx.
   if (response.ok && data && typeof data === 'object' && data.ok !== false && (typeof data.next === 'string' || data.ok === true) && !data.errors && !data.error && !data.challenge) {
    accepted = true;
    try { sessionStorage.setItem(storageKey, String(Date.now())); } catch { /* Page lock still applies. */ }
    form.reset(); announce(msg.success, true); button.textContent = msg.accepted;
   } else if (response.status === 429) { announce(msg.rate_limited, true); }
   else if (response.status === 422 && Array.isArray(data && data.errors)) {
    const fieldErrors = {};
    data.errors.forEach(error => { if (error && fields.includes(error.field)) fieldErrors[error.field] = error.field === 'email' ? 'email' : 'invalid'; });
    if (Object.keys(fieldErrors).length) showErrors(fieldErrors);
    else announce(msg.rejected, true);
   } else { announce(response.ok ? msg.unconfirmed : msg.unavailable, true); }
  } catch { announce(msg.network_error, true); }
  finally {
   clearTimeout(timer); pending = false; form.removeAttribute('aria-busy');
   fields.forEach(name => { form.elements.namedItem(name).disabled = false; }); button.disabled = accepted;
  }
 });
})();
