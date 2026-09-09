// The frontend is served by the same Express server, so relative paths work.
// If you ever host the frontend separately, set this to your backend's full URL.
const API_BASE = '';

function authHeaders(){
  const t = localStorage.getItem('ironlog_token');
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}

async function handleRes(r){
  let body = null;
  try{ body = await r.json(); }catch(e){ body = null; }
  if(!r.ok){
    const err = new Error((body && body.error) || 'Request failed');
    err.status = r.status;
    throw err;
  }
  return body;
}

const api = {
  get(path){
    return fetch(API_BASE + path, { headers: authHeaders() }).then(handleRes);
  },
  post(path, data){
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data || {})
    }).then(handleRes);
  },
  patch(path, data){
    return fetch(API_BASE + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data || {})
    }).then(handleRes);
  },
  upload(path, formData){
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: authHeaders(), // do NOT set Content-Type, browser sets the multipart boundary
      body: formData
    }).then(handleRes);
  }
};
