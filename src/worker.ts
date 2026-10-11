import type { Asset, Project, ProjectDetail, Scene, Simulation } from './shared';

interface Env { DB: D1Database; MEDIA: R2Bucket; ASSETS: Fetcher; STUDIO_ADMIN_TOKEN?: string }
interface ProjectRow { id: string; title: string; brief: string; style: string; aspect_ratio: string; target_duration: number; created_at: string; updated_at: string; scene_count?: number }
interface SceneRow { id: string; title: string; narration: string; visual_prompt: string; motion_prompt: string; duration_sec: number; reference_asset_id: string | null }
interface AssetRow { id: string; filename: string; mime_type: string; byte_size: number; created_at: string }
interface SimulationRow { id: string; scene_count: number; duration_sec: number; status: 'simulated'; created_at: string }
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers }); }
function error(message: string, status = 400): Response { return json({ error: message }, status); }
function projectFrom(row: ProjectRow): Project { return { id:row.id,title:row.title,brief:row.brief,style:row.style,aspectRatio:row.aspect_ratio as Project['aspectRatio'],targetDuration:row.target_duration,createdAt:row.created_at,updatedAt:row.updated_at,sceneCount:row.scene_count }; }
function sceneFrom(row: SceneRow): Scene { return { id:row.id,title:row.title,narration:row.narration,visualPrompt:row.visual_prompt,motionPrompt:row.motion_prompt,durationSec:row.duration_sec,referenceAssetId:row.reference_asset_id }; }
function assetFrom(row: AssetRow): Asset { return { id:row.id,filename:row.filename,mimeType:row.mime_type,byteSize:row.byte_size,createdAt:row.created_at }; }
function simulationFrom(row: SimulationRow): Simulation { return {id:row.id,sceneCount:row.scene_count,durationSec:row.duration_sec,status:row.status,createdAt:row.created_at}; }
function validText(value: unknown, max: number): value is string { return typeof value === 'string' && value.length <= max; }
function validProject(body: any): body is Pick<Project,'title'|'brief'|'style'|'aspectRatio'|'targetDuration'> {
  return body && validText(body.title,120) && body.title.trim().length > 0 &&
    validText(body.brief,4000) && validText(body.style,160) && body.style.trim().length > 0 &&
    ['9:16','16:9','1:1'].includes(body.aspectRatio) &&
    Number.isInteger(body.targetDuration) && body.targetDuration >= 5 && body.targetDuration <= 600;
}
function validScenes(value: unknown): value is Scene[] {
  if (!Array.isArray(value) || value.length > 60) return false;
  const ids = new Set<string>();
  return value.every((s: any) => {
    if (!s || typeof s.id !== 'string' || s.id.length > 80 || !/^[a-zA-Z0-9-]+$/.test(s.id) || ids.has(s.id)) return false;
    ids.add(s.id);
    return validText(s.title,120) && !!s.title.trim() && validText(s.narration,3000) &&
      validText(s.visualPrompt,5000) && validText(s.motionPrompt,5000) &&
      Number.isInteger(s.durationSec) && s.durationSec >= 1 && s.durationSec <= 30 &&
      (s.referenceAssetId === null || (typeof s.referenceAssetId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(s.referenceAssetId)));
  }) && value.reduce((n: number,s: Scene) => n+s.durationSec,0) <= 600;
}
async function parseBody(req: Request): Promise<any> { const raw=await req.text(); if(raw.length>180_000) throw new Error('Payload muito grande.'); try { return JSON.parse(raw); } catch { throw new Error('JSON inválido.'); } }
async function authorized(req: Request, secret?: string): Promise<boolean> {
  if (!secret || secret.length < 24) return false;
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'') ?? '';
  const digest=async (v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
  const [a,b]=await Promise.all([digest(token),digest(secret)]);
  let mismatch=0; for(let i=0;i<a.length;i++) mismatch |= a[i]^b[i];
  return token.length > 0 && mismatch===0;
}
async function existingProject(db: D1Database,id: string): Promise<ProjectRow | null> { return await db.prepare('SELECT * FROM projects WHERE id=? AND archived_at IS NULL').bind(id).first<ProjectRow>(); }

async function api(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url), path=url.pathname, method=req.method;
  if(path==='/api/health' && method==='GET') return json({service:'artisys-video-studio',status:'ok',engine:'simulation-only'});
  if(!env.STUDIO_ADMIN_TOKEN || env.STUDIO_ADMIN_TOKEN.length<24) return error('Configuração de autenticação ausente. Defina STUDIO_ADMIN_TOKEN.',503);
  if(!await authorized(req,env.STUDIO_ADMIN_TOKEN)) return error('Acesso não autorizado.',401);
  if(path==='/api/session' && method==='GET') return json({ok:true});
  if(path==='/api/projects' && method==='GET'){
    const {results}=await env.DB.prepare(`SELECT p.*, (SELECT COUNT(*) FROM scenes s WHERE s.project_id=p.id) scene_count FROM projects p WHERE p.archived_at IS NULL ORDER BY p.updated_at DESC LIMIT 100`).all<ProjectRow>();
    return json({projects:results.map(projectFrom)});
  }
  if(path==='/api/projects' && method==='POST'){
    const body=await parseBody(req);
    if(!validProject(body)) return error('Revise título, descrição, estilo, proporção e duração.');
    const id=crypto.randomUUID(), now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO projects(id,title,brief,style,aspect_ratio,target_duration,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id,body.title.trim(),body.brief,body.style,body.aspectRatio,body.targetDuration,now,now).run();
    return json({id},201);
  }
  const match=path.match(/^\/api\/projects\/([0-9a-f-]{36})(?:\/(.*))?$/i);
  if(!match) return error('Rota não encontrada.',404);
  const id=match[1], rest=match[2]??'';
  const project=await existingProject(env.DB,id);
  if(!project) return error('Projeto não encontrado.',404);
  if(rest==='' && method==='GET'){
    const [scenes,assets,simulations]=await Promise.all([
      env.DB.prepare('SELECT * FROM scenes WHERE project_id=? ORDER BY position ASC').bind(id).all<SceneRow>(),
      env.DB.prepare('SELECT * FROM assets WHERE project_id=? ORDER BY created_at DESC').bind(id).all<AssetRow>(),
      env.DB.prepare('SELECT * FROM simulations WHERE project_id=? ORDER BY created_at DESC LIMIT 10').bind(id).all<SimulationRow>()
    ]);
    const detail:ProjectDetail={project:projectFrom(project),scenes:scenes.results.map(sceneFrom),assets:assets.results.map(assetFrom),simulations:simulations.results.map(simulationFrom)};
    return json(detail);
  }
  if(rest==='' && method==='PATCH'){
    const body=await parseBody(req);
    if(!validProject(body)) return error('Dados do projeto inválidos.');
    await env.DB.prepare('UPDATE projects SET title=?,brief=?,style=?,aspect_ratio=?,target_duration=?,updated_at=? WHERE id=?')
      .bind(body.title.trim(),body.brief,body.style,body.aspectRatio,body.targetDuration,new Date().toISOString(),id).run();
    return json({ok:true});
  }
  if(rest==='archive' && method==='POST'){
    const now=new Date().toISOString();
    await env.DB.prepare('UPDATE projects SET archived_at=?,updated_at=? WHERE id=?').bind(now,now,id).run();
    return json({ok:true});
  }
  if(rest==='scenes' && method==='PUT'){
    const body=await parseBody(req);
    if(!validScenes(body?.scenes)) return error('Cenas inválidas. Limite: 60 cenas, 30 s por cena e 600 s no total.');
    const scenes=body.scenes as Scene[];
    const assetIds=scenes.map(s=>s.referenceAssetId).filter((x):x is string=>!!x);
    if(assetIds.length){
      const {results}=await env.DB.prepare('SELECT id FROM assets WHERE project_id=?').bind(id).all<{id:string}>();
      const allowed=new Set(results.map(a=>a.id));
      if(assetIds.some(assetId=>!allowed.has(assetId))) return error('Imagem de referência não pertence ao projeto.');
    }
    const now=new Date().toISOString();
    const statements=[env.DB.prepare('DELETE FROM scenes WHERE project_id=?').bind(id),
      ...scenes.map((s,i)=>env.DB.prepare('INSERT INTO scenes(id,project_id,position,title,narration,visual_prompt,motion_prompt,duration_sec,reference_asset_id,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .bind(s.id,id,i,s.title.trim(),s.narration,s.visualPrompt,s.motionPrompt,s.durationSec,s.referenceAssetId,now)),
      env.DB.prepare('UPDATE projects SET updated_at=? WHERE id=?').bind(now,id)];
    await env.DB.batch(statements);
    return json({ok:true,sceneCount:scenes.length});
  }
  if(rest==='simulations' && method==='POST'){
    const {results}=await env.DB.prepare('SELECT duration_sec FROM scenes WHERE project_id=? ORDER BY position').bind(id).all<{duration_sec:number}>();
    if(!results.length) return error('Adicione pelo menos uma cena antes de simular.');
    const duration=results.reduce((n,s)=>n+s.duration_sec,0);
    const simulationId=crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO simulations(id,project_id,scene_count,duration_sec,status,created_at) VALUES(?,?,?,?,?,?)')
      .bind(simulationId,id,results.length,duration,'simulated',now).run();
    return json({id:simulationId,status:'simulated',message:'Estrutura validada. Nenhum vídeo foi renderizado e nenhuma GPU foi utilizada.',sceneCount:results.length,durationSec:duration},201);
  }
  if(rest==='assets' && method==='POST'){
    const mime=req.headers.get('content-type')?.split(';')[0].toLowerCase()??'';
    const allowed=['image/png','image/jpeg','image/webp'];
    if(!allowed.includes(mime)) return error('Envie uma imagem PNG, JPG ou WebP.');
    const bytes=await req.arrayBuffer();
    if(!bytes.byteLength || bytes.byteLength > 8*1024*1024) return error('A imagem deve ter até 8 MB.');
    const filename=decodeURIComponent(req.headers.get('x-filename')??'imagem').slice(0,180).replace(/[\\/]/g,'_');
    const assetId=crypto.randomUUID(), ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime];
    const key=`projects/${id}/${assetId}.${ext}`,now=new Date().toISOString();
    await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
    try {
      await env.DB.prepare('INSERT INTO assets(id,project_id,object_key,filename,mime_type,byte_size,created_at) VALUES(?,?,?,?,?,?,?)')
        .bind(assetId,id,key,filename,mime,bytes.byteLength,now).run();
    } catch (e) { await env.MEDIA.delete(key); throw e; }
    return json({id:assetId,filename,mimeType:mime,byteSize:bytes.byteLength,createdAt:now},201);
  }
  const assetMatch=rest.match(/^assets\/([0-9a-f-]{36})$/i);
  if(assetMatch && method==='GET'){
    const asset=await env.DB.prepare('SELECT * FROM assets WHERE id=? AND project_id=?').bind(assetMatch[1],id).first<AssetRow & {object_key:string}>();
    if(!asset) return error('Arquivo não encontrado.',404);
    const object=await env.MEDIA.get(asset.object_key);
    if(!object) return error('Arquivo não disponível no armazenamento.',404);
    return new Response(object.body,{headers:{'content-type':asset.mime_type,'content-disposition':`inline; filename="reference.${asset.mime_type.split('/')[1]}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  }
  return error('Rota não encontrada.',404);
}
export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    if(!new URL(req.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try { return await api(req,env); }
    catch(e){ console.error('API failed',e); const msg=e instanceof Error && /Payload|JSON inválido/.test(e.message)?e.message:'Não foi possível concluir a operação.'; return error(msg,/Payload|JSON inválido/.test(msg)?400:500); }
  }
} satisfies ExportedHandler<Env>;
