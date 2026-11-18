"""Turn local files into readable HTML pages for INDEX.html.

MD  -> rendered Markdown (tables, code colour, table of contents); links to other .md
       files are followed and rendered too, so you can click through the docs.
JSON -> pretty, foldable tree.
Code / text (.py .bat .ps1 .js .ts .sql .yml .toml .txt …) -> syntax-coloured page.
Folder -> listing page (folders first, then files), each entry opening its rendered page.
HTML, PDF, images, video -> left as they are (the browser shows them natively).
"""
import hashlib
import html
import json
import re
from pathlib import Path
from urllib.parse import unquote

import markdown
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import TextLexer, get_lexer_for_filename

NATIVE = {".html", ".htm", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".mp4", ".webm", ".mp3"}
CODE = {".py", ".bat", ".cmd", ".ps1", ".sh", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".css", ".sql", ".yml",
        ".yaml", ".toml", ".ini", ".txt", ".csv", ".xml", ".env", ".cfg", ".log"}
SKIP_DIRS = {"node_modules", "__pycache__", ".git", "venv", ".venv", ".next", "build", "dist", "index_pages"}
MAX_PAGES = 4000
MAX_BYTES = 3_000_000
MAX_HOPS = 3       # clicks away from INDEX.html that still get a rendered page
CODE_HOPS = 1      # code files only when linked from the index or a page it links


class Renderer:
    def __init__(self, out: Path, roots):
        self.out = out
        self.roots = [Path(r).resolve() for r in roots]
        self.queue = {}  # path -> hops from INDEX.html
        self.done = set()
        self.pages = {}
        self._hops = 1
        out.mkdir(parents=True, exist_ok=True)
        for old in out.glob("*.html"):
            old.unlink()

    # ---- naming -------------------------------------------------------
    def _inside(self, p: Path) -> bool:
        return any(p == r or r in p.parents for r in self.roots)

    def page_name(self, p: Path) -> str:
        h = hashlib.sha1(str(p).lower().encode()).hexdigest()[:8]
        stem = re.sub(r"[^A-Za-z0-9_-]+", "-", p.name or "root")[:40]
        return f"{stem}-{h}.html"

    def renderable(self, p: Path) -> bool:
        if p.is_dir():
            return p.name not in SKIP_DIRS
        ext = p.suffix.lower()
        return ext in {".md", ".json"} | CODE or p.name.lower() in {"dockerfile", ".gitignore", ".env.example"}

    def link(self, p: Path, prefix: str = "", hops: int = 0) -> str:
        """URL to open p readably; queues it for rendering when needed."""
        p = Path(p).resolve()
        if not p.exists() or not self.renderable(p) or not self._inside(p):
            return p.as_uri()
        if p in self.queue:
            self.queue[p] = min(self.queue[p], hops)
            return prefix + self.page_name(p)
        limit = CODE_HOPS if p.is_file() and p.suffix.lower() not in {".md", ".json"} else MAX_HOPS
        if hops > limit or len(self.queue) >= MAX_PAGES:
            return p.as_uri()
        self.queue[p] = hops
        return prefix + self.page_name(p)

    # ---- render loop --------------------------------------------------
    def render_all(self) -> int:
        while True:
            todo = [p for p in self.queue if p not in self.done]
            if not todo:
                break
            for p in todo:
                self.done.add(p)
                self._hops = self.queue[p] + 1
                try:
                    self.pages[p] = self._render(p)
                except Exception as e:  # never stop the whole build for one file
                    self.pages[p] = (f"<p class='err'>Could not render: {html.escape(str(e))}</p>", "")
        for p, (body, toc) in self.pages.items():  # chrome last: Up only to folder pages that exist
            (self.out / self.page_name(p)).write_text(self._page(p, body, toc), encoding="utf-8")
        return len(self.pages)

    def _render(self, p: Path):
        if p.is_dir():
            return self._folder(p), ""
        if p.stat().st_size > MAX_BYTES:
            return f"<p>File is {p.stat().st_size // 1024} KB — too big to render. Use <b>Open in VS Code</b>.</p>", ""
        text = p.read_text(encoding="utf-8", errors="replace")
        ext = p.suffix.lower()
        if ext == ".md":
            return self._md(p, text)
        if ext == ".json":
            return self._json(text), ""
        return self._code(p, text), ""

    def _md(self, p: Path, text: str):
        text = re.sub(r"\A---\n.*?\n---\n", lambda m: "```yaml\n" + m.group(0).strip("-\n") + "\n```\n", text, flags=re.S)
        md = markdown.Markdown(extensions=["tables", "fenced_code", "codehilite", "toc", "sane_lists", "attr_list"],
                               extension_configs={"codehilite": {"guess_lang": False, "css_class": "hl"},
                                                  "toc": {"toc_depth": "2-3"}})
        body = md.convert(text)
        body = re.sub(r'(href|src)="([^"]+)"', lambda m: self._fix(p, m.group(1), m.group(2)), body)
        return body, md.toc if md.toc_tokens else ""

    def _fix(self, src: Path, attr: str, url: str) -> str:
        if re.match(r"^(https?:|mailto:|#|data:|vscode:)", url) or url.startswith("//"):
            ext = ' target="_blank" rel="noopener"' if url.startswith("http") and attr == "href" else ""
            return f'{attr}="{url}"{ext}'
        path, _, frag = url.partition("#")
        path = unquote(path)
        if re.match(r"^[A-Za-z]:[/\\]", path) or path.startswith("file:"):
            target = Path(path.replace("file:///", ""))
        else:
            target = (src.parent / path)
        if attr == "src":
            return f'src="{target.resolve().as_uri()}"'
        new = self.link(target, hops=self._hops)
        if frag and new.endswith(".html"):
            new += "#" + frag
        return f'href="{new}"'

    def _json(self, text: str) -> str:
        try:
            data = json.loads(text)
        except ValueError as e:
            return f"<p class='err'>Not valid JSON ({html.escape(str(e))}) — shown as text.</p><pre>{html.escape(text)}</pre>"

        def node(v, key=None, open_=True):
            k = f'<span class="k">{html.escape(str(key))}</span>: ' if key is not None else ""
            if isinstance(v, (dict, list)):
                items = v.items() if isinstance(v, dict) else enumerate(v)
                kind = f"{{{len(v)}}}" if isinstance(v, dict) else f"[{len(v)}]"
                kids = "".join(f"<li>{node(cv, ck, False)}</li>" for ck, cv in items)
                return (f'<details{" open" if open_ or len(v) <= 6 else ""}><summary>{k}<span class="m">{kind}</span>'
                        f"</summary><ul>{kids}</ul></details>")
            if isinstance(v, str):
                val = f'<span class="s">"{html.escape(v)}"</span>'
            elif v is None:
                val = '<span class="m">null</span>'
            else:
                val = f'<span class="num">{html.escape(json.dumps(v))}</span>'
            return f"{k}{val}"

        return ('<p class="tools"><button onclick="document.querySelectorAll(\'details\').forEach(d=>d.open=true)">Expand all</button> '
                '<button onclick="document.querySelectorAll(\'details\').forEach(d=>d.open=false)">Collapse all</button></p>'
                f'<div class="json">{node(data)}</div>')

    def _code(self, p: Path, text: str) -> str:
        try:
            lexer = get_lexer_for_filename(p.name, stripall=False)
        except Exception:
            lexer = TextLexer()
        return highlight(text, lexer, HtmlFormatter(cssclass="hl", linenos="table"))

    def _folder(self, p: Path) -> str:
        try:
            entries = sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except OSError as e:
            return f"<p class='err'>{html.escape(str(e))}</p>"
        rows = []
        for e in entries:
            if e.name in SKIP_DIRS or e.name.startswith("."):
                continue
            if e.is_dir():
                url = self.link(e, hops=self._hops)
                rows.append(f'<li class="dir"><a href="{url}">📁 {html.escape(e.name)}</a></li>')
            else:
                url = self.link(e, hops=self._hops) if self.renderable(e) else e.as_uri()
                kb = max(1, e.stat().st_size // 1024)
                rows.append(f'<li><a href="{url}">{html.escape(e.name)}</a><span class="m"> {kb} KB</span></li>')
        return f'<ul class="ls">{"".join(rows) or "<li>(empty)</li>"}</ul>'

    # ---- page chrome --------------------------------------------------
    def _page(self, p: Path, body: str, toc: str) -> str:
        up = p.parent
        up_link = self.page_name(up) if up.resolve() in self.pages else ""
        up_btn = (f'<a class="btn" href="{up_link}" title="Parent folder: {html.escape(up.name)}">⬑ Up</a>' if up_link else "")
        vs = "vscode://file/" + str(p).replace("\\", "/")
        side = f'<aside><div class="tt">On this page</div>{toc}</aside>' if toc else ""
        return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(p.name)}</title>
<style>{CSS}{HtmlFormatter(cssclass="hl", style="friendly").get_style_defs(".hl")}
@media (prefers-color-scheme:dark){{{HtmlFormatter(cssclass="hl", style="monokai").get_style_defs(".hl")}}}</style></head><body>
<header><a class="btn" href="../INDEX.html" title="AI Projects Index">⌂ Home</a>
<a class="btn" href="javascript:history.back()" title="Previous page (Alt+←)">← Back</a>
<a class="btn" href="javascript:history.forward()" title="Next page (Alt+→)">Forward →</a>{up_btn}
<b class="nm">{html.escape(p.name)}</b>
<span class="path">{html.escape(str(p))}</span>
<span class="act"><a href="{vs}">Open in VS Code</a> · <a href="{p.as_uri()}">Raw</a></span></header>
<div class="wrap{' has-toc' if toc else ''}">{side}<main class="{'md' if p.suffix.lower() == '.md' else ''}">{body}</main></div>
</body></html>"""


CSS = """
:root{--bg:#f7f7fb;--card:#fff;--ink:#1d1b2e;--mute:#6b6880;--line:#e6e4f0;--acc:#6b3fd4;--soft:#efeafc;--code:#f4f2fa}
@media (prefers-color-scheme:dark){:root{--bg:#14131c;--card:#1d1c28;--ink:#ecebf5;--mute:#9a97b0;--line:#2d2b3c;--acc:#a78bfa;--soft:#2a2540;--code:#23212f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,Segoe UI,sans-serif}
header{position:sticky;top:0;z-index:3;background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px;font-size:13px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
header a{color:var(--acc);text-decoration:none}header .path{color:var(--mute);font-size:11.5px;flex:1 1 100%;order:3;overflow-wrap:anywhere}
header .act{margin-left:auto}
.btn{background:var(--soft);padding:3px 10px;border-radius:6px;font-weight:600}.btn:hover{filter:brightness(.95)}.nm{margin-left:8px}
.wrap{display:flex;gap:24px;max-width:1280px;margin:0 auto;padding:20px 16px}
aside{flex:0 0 240px;position:sticky;top:70px;align-self:flex-start;max-height:calc(100vh - 90px);overflow:auto;font-size:13px;border-right:1px solid var(--line);padding-right:12px}
aside .tt{font-weight:700;color:var(--mute);text-transform:uppercase;font-size:11px;margin-bottom:6px}
aside ul{list-style:none;padding-left:10px;margin:0}aside>div>ul,aside .toc>ul{padding-left:0}aside a{color:var(--ink);text-decoration:none}aside a:hover{color:var(--acc)}
main{flex:1;min-width:0;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:20px 28px}
main.md h1{font-size:26px;border-bottom:2px solid var(--soft);padding-bottom:6px}main.md h2{font-size:20px;margin-top:28px;border-bottom:1px solid var(--line);padding-bottom:4px}
main.md h3{font-size:16.5px}main a{color:var(--acc)}
table{border-collapse:collapse;display:block;overflow-x:auto;margin:12px 0;font-size:13.5px}th,td{border:1px solid var(--line);padding:6px 10px;vertical-align:top;text-align:left}
th{background:var(--soft)}tr:nth-child(even) td{background:color-mix(in srgb,var(--soft) 35%,transparent)}
code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:.88em}pre{overflow-x:auto}
.hl{background:var(--code)!important;border-radius:8px;padding:10px 12px;font-size:13px;overflow-x:auto}.hl pre{margin:0}
.hltable{width:100%}.hltable td{border:0;padding:0}.linenos{color:var(--mute);user-select:none;padding-right:10px!important}
blockquote{margin:12px 0;padding:6px 14px;border-left:4px solid var(--acc);background:var(--soft);border-radius:0 6px 6px 0}
img{max-width:100%}hr{border:0;border-top:1px solid var(--line)}
.json{font:13px/1.55 ui-monospace,Consolas,monospace}.json ul{list-style:none;margin:0;padding-left:18px;border-left:1px dashed var(--line)}
.json summary{cursor:pointer}.k{color:var(--acc);font-weight:600}.s{color:#1a7f37}.num{color:#b35900}.m{color:var(--mute)}
@media (prefers-color-scheme:dark){.s{color:#7ee787}.num{color:#ffa657}}
.tools button{background:var(--soft);color:var(--acc);border:0;border-radius:6px;padding:4px 10px;cursor:pointer}
.ls{list-style:none;padding:0;columns:2 300px}.ls li{padding:3px 0}.ls a{text-decoration:none;font-weight:600}.ls .dir a{color:var(--ink)}
.err{color:#c0392b}
@media (max-width:800px){aside{display:none}main{padding:16px}}
"""
