import ast, json
from pathlib import Path
nb=json.loads(Path(__file__).with_name("02_animar_imagem_wan22.ipynb").read_text())
assert nb["nbformat"]==4 and len(nb["cells"])==7
ids=[c["id"] for c in nb["cells"]]
assert len(set(ids))==len(ids)
text=""
for i,c in enumerate(nb["cells"]):
    content="".join(c["source"])
    if c["cell_type"]=="code":
        assert c["outputs"]==[] and c["execution_count"] is None
        ast.parse(content)
        text+=content
for x in ("Wan22ImageToVideoLatent","files.upload()","SaveVideo","CLIPLoader","torch.cuda.is_available","files.download"):
    assert x in text,x
for x in ("modal deploy","wrangler deploy","OPENAI_API_KEY","CLOUDFLARE_API_TOKEN"):
    assert x not in text
print("V2: estrutura e sintaxe verificadas estaticamente.")
