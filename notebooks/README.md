# Gerador de Vídeo — piloto Colab gratuito

Notebook: [01_primeiro_video_gratis.ipynb](./01_primeiro_video_gratis.ipynb)

## Abra no Google Colab
1. Abra o notebook acima pelo GitHub e use **Open in Colab** ou vá a [colab.research.google.com](https://colab.research.google.com/), aba **GitHub**, e procure o repositório e a branch \`feat/p0-p1-foundation-storyboard\`.
2. Selecione um ambiente de execução com GPU gratuita (T4 se disponível).
3. Rode as cinco células na ordem: verificar GPU, instalar, prompt, gerar, visualizar/baixar.

**Modelo do primeiro teste:** CogVideoX-2B (Apache 2.0), **text-to-video**, em 720×480. CPU offload e VAE slicing/tiling diminuem uso da GPU, mas deixam a geração lenta. O modelo entrega aproximadamente 6 segundos em 49 frames a 8 FPS e o FFmpeg exporta o MP4 com 5 segundos. Não usa Wan 2.2 nem image-to-video: isso fica para uma etapa posterior.

O notebook também aceita opcionalmente um arquivo JSON com \`{"scenes":[{"visualPrompt":"...","motionPrompt":"..."}]}\`, compatível com a representação de cenas do editor P1. Não altera o projeto na nuvem.

**Sem API paga, token de serviço ou deploy.** O Colab gratuito tem cotas variáveis, GPU e RAM não garantidas e downloads de muitos GB. Não executa renderização contínua. Não define cobrança nem contrata recursos pagos.

Validação estática sem GPU: \`python notebooks/validate_notebook.py\`. Um teste de GPU real ainda precisa ser executado no Colab.
