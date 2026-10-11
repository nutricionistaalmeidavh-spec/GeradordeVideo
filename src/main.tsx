import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowDown, ArrowUp, Archive, BadgeCheck, ChevronRight, Clapperboard, Clock3, Copy, Film, FolderOpen, Image as ImageIcon, Layers3, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, MonitorPlay, Plus, Save, ShieldCheck, Sparkles, Trash2, UploadCloud, WandSparkles, X } from 'lucide-react';
import type { Asset, AspectRatio, Project, ProjectDetail, Scene, Simulation } from './shared';
import { blankScene, plannedSceneCount, PRESETS, timelineDuration } from './shared';
import './styles.css';

type ProjectDraft = Pick<Project,'title'|'brief'|'style'|'aspectRatio'|'targetDuration'>;
const defaultProject: ProjectDraft = {title:'',brief:'',style:PRESETS[0],aspectRatio:'9:16',targetDuration:30};
type Notice = {type:'good'|'bad'|'info';text:string};
const time = (seconds:number) => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
function formatDate(iso:string) { return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)); }

function App(){
  const [token,setToken]=useState('');
  const [inputToken,setInputToken]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [authorized,setAuthorized]=useState(false);
  const [projects,setProjects]=useState<Project[]>([]);
  const [loadingProjects,setLoadingProjects]=useState(false);
  const [project,setProject]=useState<ProjectDetail|null>(null);
  const [projectDraft,setProjectDraft]=useState<ProjectDraft>(defaultProject);
  const [scenes,setScenes]=useState<Scene[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const [creating,setCreating]=useState(false);
  const [createModal,setCreateModal]=useState(false);
  const [newProject,setNewProject]=useState<ProjectDraft>({...defaultProject});
  const [showSettings,setShowSettings]=useState(false);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [assetUrls,setAssetUrls]=useState<Record<string,string>>({});
  const [search,setSearch]=useState('');
  const [mobileNav,setMobileNav]=useState(false);

  async function request<T>(path:string, options:RequestInit={}, t=token):Promise<T>{
    const response=await fetch('/api'+path,{...options,headers:{...(options.body && !(options.body instanceof ArrayBuffer) && !(options.body instanceof Blob) ? {'content-type':'application/json'} : {}),'authorization':'Bearer '+t,...options.headers}});
    const contentType=response.headers.get('content-type')??'';
    const data=contentType.includes('application/json')?await response.json():null;
    if(!response.ok) throw new Error(data?.error??'A operação não foi concluída.');
    return data as T;
  }
  function showError(e:unknown) { setNotice({type:'bad',text:e instanceof Error?e.message:'Ocorreu uma falha.'}); }
  async function login(e:FormEvent){
    e.preventDefault();setAuthBusy(true);setNotice(null);
    try{
      await request<{ok:boolean}>('/session',{},inputToken);
      setToken(inputToken);setInputToken('');setAuthorized(true);
    } catch(e) { showError(e); } finally { setAuthBusy(false); }
  }
  function logout(){setToken('');setAuthorized(false);setProject(null);setProjects([]);setAssetUrls({});setSelectedId(null);setMobileNav(false);}
  async function refreshProjects(){
    setLoadingProjects(true);
    try { const data=await request<{projects:Project[]}>('/projects');setProjects(data.projects); }
    catch(e){showError(e);}finally{setLoadingProjects(false);}
  }
  useEffect(()=>{if(authorized) void refreshProjects();},[authorized]);
  async function openProject(id:string){
    setBusy(true);setNotice(null);setShowSettings(false);
    try{
      const data=await request<ProjectDetail>('/projects/'+id);
      setProject(data);setProjectDraft({title:data.project.title,brief:data.project.brief,style:data.project.style,aspectRatio:data.project.aspectRatio,targetDuration:data.project.targetDuration});
      setScenes(data.scenes);setSelectedId(data.scenes[0]?.id??null);setDirty(false);setMobileNav(false);
    }catch(e){showError(e);}finally{setBusy(false);}
  }
  function backToProjects(){if(dirty && !window.confirm('Existem alterações não salvas. Deseja sair sem salvar?')) return;setProject(null);setDirty(false);setAssetUrls({});setNotice(null);void refreshProjects();}
  function updateProject<K extends keyof ProjectDraft>(key:K,value:ProjectDraft[K]){setProjectDraft(p=>({...p,[key]:value}));setDirty(true);}
  function updateScene<K extends keyof Scene>(key:K,value:Scene[K]){setScenes(v=>v.map(s=>s.id===selectedId?{...s,[key]:value}:s));setDirty(true);}
  function addScene(){
    if(scenes.length>=60){setNotice({type:'bad',text:'O storyboard aceita até 60 cenas.'});return;}
    const newScene=blankScene(scenes.length+1);
    setScenes(v=>[...v,newScene]);setSelectedId(newScene.id);setDirty(true);
  }
  function duplicateScene(){
    const index=scenes.findIndex(s=>s.id===selectedId);if(index<0 || scenes.length>=60)return;
    const clone={...scenes[index],id:crypto.randomUUID(),title:scenes[index].title+' (cópia)'};
    setScenes(v=>[...v.slice(0,index+1),clone,...v.slice(index+1)]);setSelectedId(clone.id);setDirty(true);
  }
  function reorderScene(delta:number){
    const index=scenes.findIndex(s=>s.id===selectedId),destination=index+delta;
    if(index<0 || destination<0 || destination>=scenes.length)return;
    const next=[...scenes];[next[index],next[destination]]=[next[destination],next[index]];
    setScenes(next);setDirty(true);
  }
  function removeScene(){
    const index=scenes.findIndex(s=>s.id===selectedId);if(index<0)return;
    if(!window.confirm('Remover esta cena do storyboard? A remoção só será efetivada quando você salvar.'))return;
    const next=scenes.filter(s=>s.id!==selectedId);setScenes(next);setSelectedId(next[Math.min(index,next.length-1)]?.id??null);setDirty(true);
  }
  async function save():Promise<boolean>{
    if(!project)return false;
    if(!projectDraft.title.trim()){setNotice({type:'bad',text:'Informe o título do projeto.'});setShowSettings(true);return false;}
    if(scenes.length>60 || timelineDuration(scenes)>600 || scenes.some(s=>!s.title.trim()||s.durationSec<1||s.durationSec>30)){
      setNotice({type:'bad',text:'Revise os títulos e as durações das cenas. Máximo de 30 s por cena e 10 min no total.'});return false;
    }
    setSaving(true);setNotice(null);
    try{
      await request('/projects/'+project.project.id,{method:'PATCH',body:JSON.stringify(projectDraft)});
      await request('/projects/'+project.project.id+'/scenes',{method:'PUT',body:JSON.stringify({scenes})});
      setProject(p=>p?{...p,project:{...p.project,...projectDraft,updatedAt:new Date().toISOString()},scenes}:p);
      setDirty(false);setNotice({type:'good',text:'Projeto e storyboard salvos no banco de dados.'});return true;
    }catch(e){showError(e);return false;}finally{setSaving(false);}
  }
  async function create(e:FormEvent){
    e.preventDefault();if(!newProject.title.trim())return;setCreating(true);
    try{
      const result=await request<{id:string}>('/projects',{method:'POST',body:JSON.stringify(newProject)});
      setCreateModal(false);setNewProject({...defaultProject});await refreshProjects();await openProject(result.id);
      setShowSettings(false);setNotice({type:'info',text:'Projeto criado. Adicione a primeira cena ao storyboard.'});
    }catch(e){showError(e);}finally{setCreating(false);}
  }
  async function simulate(){
    if(!project)return;
    if(!scenes.length){setNotice({type:'bad',text:'Crie pelo menos uma cena antes de simular.'});return;}
    setBusy(true);
    try{
      if(dirty && !await save())return;
      const result=await request<{sceneCount:number;durationSec:number;message:string}>('/projects/'+project.project.id+'/simulations',{method:'POST'});
      const detail=await request<ProjectDetail>('/projects/'+project.project.id);
      setProject(detail);
      setNotice({type:'info',text:result.message});
    }catch(e){showError(e);}finally{setBusy(false);}
  }
  async function archiveProject(){
    if(!project || !window.confirm('Arquivar este projeto? Ele sairá da lista de projetos ativos.'))return;
    setBusy(true);try{await request('/projects/'+project.project.id+'/archive',{method:'POST'});setProject(null);setDirty(false);await refreshProjects();setNotice({type:'good',text:'Projeto arquivado.'});}catch(e){showError(e);}finally{setBusy(false);}
  }
  async function uploadImage(file?:File){
    if(!file||!project||!selectedId)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>8*1024*1024){setNotice({type:'bad',text:'Selecione PNG, JPG ou WebP de até 8 MB.'});return;}
    setUploading(true);
    try{
      const asset=await request<Asset>('/projects/'+project.project.id+'/assets',{method:'POST',headers:{'content-type':file.type,'x-filename':encodeURIComponent(file.name)},body:file});
      setProject(p=>p?{...p,assets:[asset,...p.assets]}:p);
      updateScene('referenceAssetId',asset.id);
      setNotice({type:'info',text:'Imagem enviada ao R2. Salve o storyboard para manter o vínculo com a cena.'});
    }catch(e){showError(e);}finally{setUploading(false);}
  }
  useEffect(()=>{
    if(!project || !token || !project.assets.length){setAssetUrls({});return;}
    let cancelled=false; const urls:string[]=[];
    void Promise.all(project.assets.map(async asset=>{
      try{
        const response=await fetch('/api/projects/'+project.project.id+'/assets/'+asset.id,{headers:{authorization:'Bearer '+token}});
        if(!response.ok) return [asset.id,''] as const;
        const url=URL.createObjectURL(await response.blob());urls.push(url);return [asset.id,url] as const;
      }catch{return [asset.id,''] as const;}
    })).then(pairs=>{if(!cancelled)setAssetUrls(Object.fromEntries(pairs));});
    return ()=>{cancelled=true;urls.forEach(URL.revokeObjectURL);};
  },[project?.project.id,project?.assets,token]);

  const selected=useMemo(()=>scenes.find(s=>s.id===selectedId)??null,[scenes,selectedId]);
  const filtered=projects.filter(p=>(p.title+' '+p.brief).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const totalTime=timelineDuration(scenes);
  const renderEstimate=plannedSceneCount(projectDraft.targetDuration);
  const selectedNumber=scenes.findIndex(s=>s.id===selectedId)+1;
  const lastSimulation:Simulation|undefined=project?.simulations[0];

  if(!authorized){
    return <main className="login-screen">
      <div className="login-orb orb-one"/><div className="login-orb orb-two"/>
      <section className="login-card">
        <div className="brand-mark large"><Clapperboard size={27}/></div>
        <span className="eyebrow">ARTISYS / CREATIVE TOOLS</span>
        <h1>Artisys <span>Video Studio.</span></h1>
        <p>Seu espaço para construir histórias visuais, cena por cena. A geração com GPU estará disponível em uma próxima entrega.</p>
        <form onSubmit={login} className="login-form">
          <label htmlFor="adminToken">Token administrativo</label>
          <div className="secret-input"><LockKeyhole size={18}/><input id="adminToken" type="password" autoComplete="off" placeholder="Informe a chave de acesso" required value={inputToken} onChange={e=>setInputToken(e.target.value)}/></div>
          <button disabled={authBusy} className="primary-btn full" type="submit">{authBusy?<LoaderCircle className="spin" size={18}/>:<ShieldCheck size={18}/>} Acessar estúdio</button>
        </form>
        {notice&&<div role="alert" className={'notice '+notice.type}>{notice.text}</div>}
        <div className="login-footer"><BadgeCheck size={15}/> Ambiente privado · Nenhuma GPU será cobrada nesta versão</div>
      </section>
    </main>;
  }
  return <div className="app-shell">
    <aside className={'sidebar '+(mobileNav?'open':'')}>
      <div className="sidebar-brand"><div className="brand-mark"><Clapperboard size={21}/></div><div><strong>Artisys</strong><small>VIDEO STUDIO</small></div><button className="icon-btn nav-close" onClick={()=>setMobileNav(false)} aria-label="Fechar menu"><X size={20}/></button></div>
      <div className="sidebar-section-title">WORKSPACE</div>
      <button className={'nav-link '+(!project?'active':'')} onClick={()=>{if(project)backToProjects();setMobileNav(false)}}><LayoutDashboard size={19}/> Visão geral</button>
      <button className={'nav-link '+(project?'active':'')} onClick={()=>{if(project){setMobileNav(false);}else{setCreateModal(true);setMobileNav(false)}}}><Layers3 size={19}/> Storyboard {project&&<span className="nav-dot"/>}</button>
      <div className="sidebar-section-title recent-title">PROJETOS RECENTES</div>
      <div className="sidebar-projects">{projects.slice(0,6).map(p=><button key={p.id} className={'recent-project '+(project?.project.id===p.id?'chosen':'')} onClick={()=>{if(dirty && !window.confirm('Sair e descartar alterações não salvas?'))return;void openProject(p.id)}}><span className="project-small-dot"/><span>{p.title}</span></button>)}{!projects.length&&<p className="sidebar-muted">Nenhum projeto ainda</p>}</div>
      <div className="sidebar-bottom"><div className="sidebar-plan"><span className="plan-icon"><ShieldCheck size={17}/></span><div><strong>Modo gratuito</strong><small>Renderizador simulado</small></div></div><button className="nav-link logout" onClick={logout}><LogOut size={18}/> Encerrar sessão</button></div>
    </aside>
    {mobileNav&&<button className="nav-scrim" aria-label="Fechar menu" onClick={()=>setMobileNav(false)}/>}
    <div className="workspace">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn hamburger" aria-label="Abrir menu" onClick={()=>setMobileNav(true)}><Layers3 size={20}/></button><span className="breadcrumb-root">Workspace</span><ChevronRight size={15} className="breadcrumb-chevron"/><span className="breadcrumb-current">{project?'Editor de projeto':'Visão geral'}</span></div><div className="topbar-right"><span className="environment"><span/> SIMULAÇÃO</span><div className="avatar" title="Administrador">A</div></div></header>
      <main className="page-content">
      {notice&&<div className={'notice floating '+notice.type} role="status"><span>{notice.text}</span><button className="icon-btn" aria-label="Fechar aviso" onClick={()=>setNotice(null)}><X size={15}/></button></div>}
      {!project ? <>
        <div className="page-heading"><div><div className="section-kicker"><Sparkles size={15}/> CRIAÇÃO DE VÍDEOS COM IA</div><h1>Seu estúdio criativo.</h1><p>Do primeiro roteiro ao storyboard pronto para renderizar.</p></div><button className="primary-btn heading-button" onClick={()=>setCreateModal(true)}><Plus size={18}/> Novo projeto</button></div>
        <div className="summary-grid">
          <div className="stat-card"><div className="stat-top"><span>Projetos ativos</span><FolderOpen size={20}/></div><strong>{projects.length.toString().padStart(2,'0')}</strong><small>Ideias e produções em andamento</small></div>
          <div className="stat-card"><div className="stat-top"><span>Cenas planejadas</span><Layers3 size={20}/></div><strong>{projects.reduce((n,p)=>n+(p.sceneCount??0),0).toString().padStart(2,'0')}</strong><small>Distribuídas entre seus projetos</small></div>
          <div className="stat-card accent"><div className="stat-top"><span>Infraestrutura</span><ShieldCheck size={20}/></div><strong>R$ 0</strong><small>GPU desativada · Sem custo adicional obrigatório</small></div>
        </div>
        <div className="section-heading"><div><h2>Seus projetos</h2><p>Retome o trabalho exatamente de onde parou.</p></div><div className="search-box"><input aria-label="Buscar projetos" value={search} placeholder="Buscar por nome ou tema..." onChange={e=>setSearch(e.target.value)}/></div></div>
        {loadingProjects&&<div className="loading-line"><LoaderCircle className="spin" size={20}/> Carregando projetos...</div>}
        {!loadingProjects && !filtered.length && <div className="empty-state"><div className="empty-art"><Film size={34}/></div><h3>{projects.length?'Nenhum projeto encontrado':'Uma boa história começa aqui.'}</h3><p>{projects.length?'Tente outro termo na busca.':'Crie seu primeiro projeto, defina o visual e organize o vídeo em cenas.'}</p><button className="primary-btn" onClick={()=>{setSearch('');setCreateModal(true)}}><Plus size={18}/> Criar projeto</button></div>}
        <div className="project-grid">{filtered.map(p=><button className="project-card" key={p.id} onClick={()=>void openProject(p.id)}><div className="project-thumbnail"><span className="thumbnail-ratio">{p.aspectRatio}</span><div className="thumbnail-film"><Film size={38}/></div><span className="thumbnail-badge">RASCUNHO</span></div><div className="project-card-body"><strong>{p.title}</strong><p>{p.brief||'Sem descrição adicionada.'}</p><div className="project-meta"><span><Clock3 size={14}/>{time(p.targetDuration)} alvo</span><span><Layers3 size={14}/>{p.sceneCount??0} cenas</span></div><div className="project-footer"><span>Atualizado {formatDate(p.updatedAt)}</span><span className="card-open">Abrir <ChevronRight size={15}/></span></div></div></button>)}</div>
      </>:<>
        <div className="editor-top"><button className="back-link" onClick={backToProjects}><ArrowLeft size={17}/> Todos os projetos</button><div className="editor-actions"><span className={'save-state '+(dirty?'unsaved':'')}><span/>{saving?'Salvando...':dirty?'Alterações não salvas':'Tudo salvo'}</span><button className="secondary-btn" onClick={()=>setShowSettings(s=>!s)}><Sparkles size={17}/> Configurar projeto</button><button className="primary-btn" disabled={saving||busy} onClick={()=>void save()}>{saving?<LoaderCircle className="spin" size={16}/>:<Save size={16}/>} Salvar projeto</button></div></div>
        <div className="project-title-block"><div><div className="section-kicker">PROJETO / STORYBOARD</div><h1>{projectDraft.title}</h1><p>{projectDraft.brief||'Configure seu tema e transforme-o em cenas.'}</p></div><div className="project-tags"><span><Clock3 size={14}/>{time(projectDraft.targetDuration)} alvo</span><span>{projectDraft.aspectRatio}</span></div></div>
        {showSettings&&<section className="settings-panel"><div className="subsection-head"><div><strong>Configurações do projeto</strong><p>Esses dados definem o contexto de todas as cenas.</p></div><button className="icon-btn" aria-label="Fechar configurações" onClick={()=>setShowSettings(false)}><X size={18}/></button></div><ProjectFields value={projectDraft} onChange={updateProject}/><div className="settings-footer"><button className="danger-text" onClick={()=>void archiveProject()}><Archive size={15}/> Arquivar projeto</button><button className="secondary-btn" onClick={()=>setShowSettings(false)}>Voltar ao storyboard</button></div></section>}
        <div className="progress-strip"><div><strong>{scenes.length} {scenes.length===1?'cena':'cenas'}</strong><span>·</span><span>{time(totalTime)} planejados de {time(projectDraft.targetDuration)}</span></div><span className={'target-note '+(totalTime>projectDraft.targetDuration?'over':'')}>{scenes.length? totalTime===projectDraft.targetDuration?'Duração alinhada':totalTime>projectDraft.targetDuration?'Acima da duração-alvo':`Faltam ${time(projectDraft.targetDuration-totalTime)} para a meta`:'Adicione a primeira cena'}</span><div className="time-track"><div style={{width:Math.min(100,totalTime/Math.max(1,projectDraft.targetDuration)*100)+'%'}}/></div></div>
        <div className="editor-grid">
          <section className="scenes-panel"><div className="panel-heading"><div><h2>Storyboard</h2><p>Sequência de cenas</p></div><button className="small-plus" onClick={addScene} aria-label="Adicionar cena"><Plus size={20}/></button></div><div className="scenes-list">{scenes.map((s,i)=><button key={s.id} className={'scene-row '+(s.id===selectedId?'active':'')} onClick={()=>setSelectedId(s.id)}><div className="scene-mini"><span>{String(i+1).padStart(2,'0')}</span></div><div className="scene-row-text"><strong>{s.title||'Cena sem título'}</strong><small>{s.narration||s.visualPrompt||'Adicione as instruções desta cena'}</small></div><span className="scene-seconds">{s.durationSec}s</span></button>)}</div>{!scenes.length&&<p className="scenes-empty">Nenhuma cena cadastrada.</p>}<button className="add-scene-btn" onClick={addScene}><Plus size={17}/> Adicionar cena</button><div className="panel-hint"><WandSparkles size={15}/> Dica: cenas curtas de 4 a 8 segundos ajudam a manter a consistência visual.</div></section>
          <section className="scene-editor-panel">
            {!selected?<div className="editor-empty"><div className="empty-art"><Layers3 size={33}/></div><h3>Seu storyboard está vazio</h3><p>Adicione uma cena para começar a estruturar o vídeo.</p><button className="primary-btn" onClick={addScene}><Plus size={17}/> Adicionar primeira cena</button></div>:<>
              <div className="panel-heading"><div><div className="section-kicker">CENA {String(selectedNumber).padStart(2,'0')} / {String(scenes.length).padStart(2,'0')}</div><h2>Detalhes da cena</h2></div><div className="scene-controls"><button className="icon-btn" aria-label="Mover cena para cima" title="Mover para cima" disabled={selectedNumber<=1} onClick={()=>reorderScene(-1)}><ArrowUp size={17}/></button><button className="icon-btn" aria-label="Mover cena para baixo" title="Mover para baixo" disabled={selectedNumber===scenes.length} onClick={()=>reorderScene(1)}><ArrowDown size={17}/></button><button className="icon-btn" aria-label="Duplicar cena" title="Duplicar" disabled={scenes.length>=60} onClick={duplicateScene}><Copy size={17}/></button><button className="icon-btn danger-icon" aria-label="Remover cena" title="Remover" onClick={removeScene}><Trash2 size={17}/></button></div></div>
              <div className="editor-form"><div className="two-col"><label className="field">Título da cena<input maxLength={120} value={selected.title} onChange={e=>updateScene('title',e.target.value)} placeholder="Ex.: O cérebro acorda"/></label><label className="field">Duração (segundos)<input type="number" min={1} max={30} value={selected.durationSec} onChange={e=>updateScene('durationSec',Number(e.target.value))}/></label></div><label className="field">Narração <span className="hint-inline">O que o público vai ouvir</span><textarea rows={3} maxLength={3000} value={selected.narration} onChange={e=>updateScene('narration',e.target.value)} placeholder="Você sabia que o cérebro continua trabalhando enquanto dormimos?"/></label><label className="field">Prompt visual <span className="hint-inline">Personagem, cenário, iluminação e estilo</span><textarea rows={4} maxLength={5000} value={selected.visualPrompt} onChange={e=>updateScene('visualPrompt',e.target.value)} placeholder="Friendly anthropomorphic brain, stylized 3D animation, vibrant neural environment..."/></label><label className="field">Prompt de movimento <span className="hint-inline">O que muda ao longo da cena</span><textarea rows={3} maxLength={5000} value={selected.motionPrompt} onChange={e=>updateScene('motionPrompt',e.target.value)} placeholder="The brain smiles, raises one hand and looks at the camera. Slow camera push-in..."/></label><div className="reference-section"><div><strong>Imagem de referência</strong><p>Ajuda a manter o mesmo personagem entre cenas.</p></div><div className="reference-controls"><label className={'upload-btn '+(uploading?'busy':'')}><UploadCloud size={17}/>{uploading?'Enviando...':'Enviar imagem'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={e=>{void uploadImage(e.target.files?.[0]);e.target.value='';}} hidden/></label><select aria-label="Imagem de referência" value={selected.referenceAssetId??''} onChange={e=>updateScene('referenceAssetId',e.target.value||null)}><option value="">Sem referência</option>{project.assets.map(a=><option key={a.id} value={a.id}>{a.filename}</option>)}</select></div></div></div>
            </>}
          </section>
          <aside className="preview-panel"><div className="panel-heading"><div><h2>Prévia visual</h2><p>Composição da cena</p></div><span className="preview-info">{projectDraft.aspectRatio}</span></div><div className="preview-stage"><div className={'preview-frame ratio-'+projectDraft.aspectRatio.replace(':','-')}>{selected?.referenceAssetId && assetUrls[selected.referenceAssetId]?<img src={assetUrls[selected.referenceAssetId]} alt="Imagem de referência da cena" />:<div className="preview-placeholder"><div className="preview-glow"/><Clapperboard size={38}/><span>REFERÊNCIA VISUAL</span><small>{selected?'Envie uma imagem para pré-visualizar':'Selecione uma cena'}</small></div>}<span className="frame-timestamp">{selected?time(selected.durationSec):'0:00'}</span></div></div><div className="preview-explainer"><ShieldCheck size={17}/><div><strong>Prévia, não renderização</strong><p>Esta etapa organiza cenas e referências. Os vídeos reais serão gerados na P2.</p></div></div><div className="render-section"><div className="render-section-head"><h3>Simulação de produção</h3><span>R$ 0</span></div><p>Valide a estrutura do projeto sem executar IA ou consumir créditos.</p><div className="render-metrics"><span>{scenes.length} cenas</span><span>{time(totalTime)}</span></div><button className="secondary-btn full" disabled={!scenes.length||busy||saving} onClick={()=>void simulate()}>{busy?<LoaderCircle className="spin" size={17}/>:<MonitorPlay size={17}/>} Simular projeto</button>{lastSimulation&&<p className="simulation-history"><BadgeCheck size={15}/> Última simulação: {formatDate(lastSimulation.createdAt)} · {lastSimulation.sceneCount} cenas. Nenhum MP4 gerado.</p>}</div><div className="preview-footer"><ImageIcon size={16}/> {project.assets.length} {project.assets.length===1?'imagem enviada':'imagens enviadas'} ao R2</div></aside>
        </div>
        <div className="bottom-banner"><div className="banner-icon"><Sparkles size={21}/></div><div><strong>Pronto para transformar o storyboard em vídeo?</strong><p>O motor GPU será integrado na P2. Por enquanto, revise e salve suas cenas.</p></div><button className="secondary-btn" onClick={()=>void save()} disabled={saving||busy}><Save size={16}/> Salvar storyboard</button></div>
      </>}
      </main>
    </div>
    {createModal&&<div className="modal-backdrop" onClick={()=>setCreateModal(false)}><div role="dialog" aria-modal="true" aria-labelledby="new-project-title" className="modal" onClick={e=>e.stopPropagation()}><div className="modal-heading"><div><div className="section-kicker"><Sparkles size={14}/> NOVA PRODUÇÃO</div><h2 id="new-project-title">Criar novo projeto</h2><p>Comece pelo conceito. As cenas vêm depois.</p></div><button className="icon-btn" aria-label="Fechar" onClick={()=>setCreateModal(false)}><X size={20}/></button></div><form onSubmit={create}><ProjectFields value={newProject} onChange={(key,value)=>setNewProject(p=>({...p,[key]:value}))}/><div className="modal-footer"><button type="button" className="secondary-btn" onClick={()=>setCreateModal(false)}>Cancelar</button><button type="submit" className="primary-btn" disabled={creating}>{creating?<LoaderCircle size={16} className="spin"/>:<Plus size={17}/>} Criar projeto</button></div></form></div></div>}
  </div>;
}
function ProjectFields({value,onChange}:{value:ProjectDraft;onChange:<K extends keyof ProjectDraft>(key:K,value:ProjectDraft[K])=>void}){
  return <div className="project-fields">
    <label className="field">Nome do projeto<input required maxLength={120} value={value.title} onChange={e=>onChange('title',e.target.value)} placeholder="Ex.: A aventura das bactérias intestinais"/></label>
    <label className="field">Tema e objetivo <span className="hint-inline">Opcional</span><textarea maxLength={4000} rows={3} value={value.brief} onChange={e=>onChange('brief',e.target.value)} placeholder="O que você quer ensinar ou contar neste vídeo?"/></label>
    <label className="field">Estilo visual<select value={value.style} onChange={e=>onChange('style',e.target.value)}>{!PRESETS.includes(value.style as typeof PRESETS[number])&&<option value={value.style}>{value.style}</option>}{PRESETS.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
    <div className="two-col"><label className="field">Formato<select value={value.aspectRatio} onChange={e=>onChange('aspectRatio',e.target.value as AspectRatio)}><option value="9:16">Vertical · 9:16</option><option value="16:9">Horizontal · 16:9</option><option value="1:1">Quadrado · 1:1</option></select></label><label className="field">Duração-alvo (segundos)<input type="number" min={5} max={600} required value={value.targetDuration} onChange={e=>onChange('targetDuration',Number(e.target.value))}/></label></div>
    <p className="form-helper"><Clock3 size={14}/> Duração-alvo: {time(Number.isFinite(value.targetDuration)?Math.max(0,value.targetDuration):0)} · aproximadamente {plannedSceneCount(Math.max(0,value.targetDuration))} cenas de 5 s.</p>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
