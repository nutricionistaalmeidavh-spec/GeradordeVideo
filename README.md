# Artisys Video Studio

P0 + P1: painel de projetos e storyboard com React, TypeScript e Cloudflare Workers (D1 + R2). Sem serviços de IA pagos nem renderização real nesta etapa.

## Funcionalidades

- Autenticação administrativa via segredo de Worker (`STUDIO_ADMIN_TOKEN`, obrigatório, >=24 caracteres); token nunca é salvo no navegador.
- Projetos: título, tema/brief, estilo, duração-alvo, proporção, edição e arquivamento.
- Storyboard: criar, editar, reordenar, duplicar e remover cenas; narração, prompts de imagem e movimento, duração por cena e imagem de referência.
- Upload de imagens para R2, vinculadas ao projeto; biblioteca e consulta autenticada.
- Simulação de produção: registra quantidade de cenas e duração, mas **não** cria MP4, não usa GPU e não cobra nada.
- Estado de salvamento explícito. Nenhum serviço externo de IA é necessário para operar P0/P1.

## Ambiente e instalação

```bash
npm install
npm run check
npm test
npm run build
cp .dev.vars.example .dev.vars
# altere o token para um segredo aleatório longo
npx wrangler d1 create artisys-video-db
npx wrangler r2 bucket create artisys-video-media
# copie o database_id real para wrangler.jsonc
npm run db:migrate:local
npm run worker:dev
# outro terminal:
npm run dev
```

Para produção: provisionar D1/R2, configurar bindings, executar `npm run db:migrate:remote`, adicionar `STUDIO_ADMIN_TOKEN` via `wrangler secret put STUDIO_ADMIN_TOKEN`, e só então habilitar o deploy pelo Cloudflare Git integration para `main`.

### Segurança e limites

O acesso HTTP exige token explícito via cabeçalho Authorization. Se o secret não existir, a API falha fechada (503). Não habilite bypass de autenticação em produção. O frontend público mostra apenas a tela de login até a autenticação. Para uma versão multiusuário, substituir o token de administrador por Cloudflare Access/OIDC em uma entrega posterior. Controle de gastos na futura P2 deve permanecer desligado por padrão.

## CI / deploy

O workflow `.github/workflows/qa.yml` roda **somente quando disparado manualmente** em Actions → Manual QA → Run workflow. Não existem triggers push, pull_request ou schedule. O deploy de produção será configurado **apenas no Cloudflare, branch main**; não há GitHub workflow de deploy.

## Estrutura

- `src/worker.ts`: API com autenticação e acesso a D1/R2
- `src/main.tsx`: interface React
- `src/shared.ts`: modelos canônicos e helpers
- `src/styles.css`: estilos responsivos
- `migrations/`: schema versionado
- `wrangler.jsonc`: bindings do Worker (ID do D1 pendente de provisionamento)

## Próximos marcos

P2: adaptador GPU (Modal, Vast.ai ou outro), execução assíncrona real, filas, cotas rígidas, logs e recuperação. P3: TTS, legendas e FFmpeg.
