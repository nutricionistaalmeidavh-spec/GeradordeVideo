import { describe, it, expect, vi } from 'vitest';
import worker from './worker';

const SECRET='test-secret-which-has-at-least-24-characters';
const endpoint='https://local.test';
function env(secret?:string){
  return {
    STUDIO_ADMIN_TOKEN:secret,
    ASSETS:{fetch:vi.fn(async()=>new Response('<html>OK</html>'))},
    MEDIA:{},
    DB:{}
  } as unknown as Parameters<typeof worker.fetch>[1];
}
function req(path:string, token?:string,init:RequestInit={}){
  const headers=new Headers(init.headers);
  if(token)headers.set('Authorization','Bearer '+token);
  return new Request(endpoint+path,{...init,headers});
}
describe('security and simulation boundaries',()=>{
  it('exposes a non-sensitive health indicator',async()=>{
    const response=await worker.fetch(req('/api/health'),env());
    expect(response.status).toBe(200);
    expect((await response.json()).engine).toBe('simulation-only');
  });
  it('fails closed if admin secret is missing or short',async()=>{
    expect((await worker.fetch(req('/api/projects','guess'),env())).status).toBe(503);
    expect((await worker.fetch(req('/api/projects','guess'),env('short'))).status).toBe(503);
  });
  it('rejects missing and incorrect tokens before any database calls',async()=>{
    expect((await worker.fetch(req('/api/projects'),env(SECRET))).status).toBe(401);
    expect((await worker.fetch(req('/api/projects','invalid'),env(SECRET))).status).toBe(401);
  });
  it('allows a correct token to open its administrative session',async()=>{
    const response=await worker.fetch(req('/api/session',SECRET),env(SECRET));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok:true});
  });
  it('rejects invalid project data before attempting database writes',async()=>{
    const response=await worker.fetch(req('/api/projects',SECRET,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'',aspectRatio:'bad',targetDuration:-1})}),env(SECRET));
    expect(response.status).toBe(400);
  });
  it('never claims to have generated a video from health endpoint',async()=>{
    const body=await (await worker.fetch(req('/api/health'),env(SECRET))).text();
    expect(body).not.toContain('mp4');
    expect(body).toContain('simulation-only');
  });
});
