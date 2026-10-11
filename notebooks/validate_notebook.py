"""Validate Colab notebook structure and cell syntax, without executing a GPU."""
import ast
import json
from pathlib import Path

path = Path(__file__).with_name("01_primeiro_video_gratis.ipynb")
notebook = json.loads(path.read_text(encoding="utf-8"))
assert notebook["nbformat"] == 4
assert len(notebook["cells"]) == 6
assert notebook["cells"][0]["cell_type"] == "markdown"
scripts = []
for index, item in enumerate(notebook["cells"]):
    assert isinstance(item["source"], list)
    source = "".join(item["source"])
    if item["cell_type"] == "code":
        assert item["outputs"] == []
        assert item["execution_count"] is None
        ast.parse(source, filename=f"{path.name}:{index}")
        scripts.append(source)
all_scripts = "\n".join(scripts)
for required in ("CogVideoXPipeline", "enable_sequential_cpu_offload", "ffmpeg", "files.download"):
    assert required in all_scripts, required
for forbidden in ("wrangler deploy", "modal deploy", "OPENAI_API_KEY", "CLOUDFLARE_API_TOKEN"):
    assert forbidden not in all_scripts, forbidden
print("Notebook válido: JSON, sintaxe das células e checagens estáticas.")
