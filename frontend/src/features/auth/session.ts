import { sessionRequest } from './sessionClient';
export async function clearSession() {
 await sessionRequest('/auth/logout',{method:'POST'});
 window.dispatchEvent(new Event('ss:auth-changed'));
}
