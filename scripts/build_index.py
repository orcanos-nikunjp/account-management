"""Build INDEX.html — one local page that links every AI project, doc, deck and skill.

Run:  python scripts/build_index.py      (writes ../INDEX.html next to this repo's README)
Skills are read live from ~/.claude/skills (name + description from each SKILL.md),
so re-running picks up new ones. Every other link is listed below; a missing file is
shown struck through so stale entries are easy to spot.
"""
import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from index_render import Renderer  # noqa: E402

AI = Path(r"C:/AI Projects")
TM = AI / "traceability-matrix"
AM = AI / "compliance-platform" / "account-management"
QMS = AI / "Orcanos QMS"
SKILLS = Path.home() / ".claude" / "skills"
OUT = AM / "INDEX.html"
R = Renderer(AM / "index_pages", roots=[AI, Path.home() / ".claude"])

# (title, path-or-url, one-liner)
SECTIONS = [
    ("Live apps & published help", "web", [
        ("Account management", "https://accounts.orcanos.ai", "Staff app: accounts, licences, AI engine, credits, usage, presentations"),
        ("Traceability (US)", "https://traceability.orcanos.ai", "Trace matrix + every module (DHF, Risk, QMS, BOM, SBOM…)"),
        ("Traceability (EU)", "https://eu.traceability.orcanos.ai", "Same app, EU region"),
        ("All presentations (served)", "https://traceability.orcanos.ai/orcanos-presentations.html", "Every customer deck in one viewer"),
        ("Ask Paul in Orcanos", "https://br.orcanos.com/ext/chat", "Compliance AI chat inside Orcanos"),
        ("Orcanos master", "https://app.orcanos.com/master", "Orcanos master tenant"),
        ("Traceability user manual (GitBook)", "https://orcanos.gitbook.io/traceability-marix/", "Customer help for the Traceability platform"),
        ("Ask Paul user manual (GitBook)", "https://orcanos.gitbook.io/orcanos-qms-ai/", "Customer help for Ask Paul"),
    ]),
    ("Account management", "am", [
        ("CLAUDE.md", AM / "CLAUDE.md", "Start here — architecture, traps, conventions (v1.12.x)"),
        ("README.md", AM / "README.md", "Setup, scripts, deltas from QMS"),
        ("ARCHITECTURE.md", AM / "ARCHITECTURE.md", "Request lifecycle, module map, provisioning"),
        ("SCHEMA.md", AM / "SCHEMA.md", "Every table and column"),
        ("SECURITY.md", AM / "SECURITY.md", "Gate, encryption, SSRF, audit trail"),
        ("Security audit 2026-08-29", AM / "SECURITY_AUDIT_2026-08-29.md", "Last full security review + open items"),
        ("DEPLOYMENT.md", AM / "DEPLOYMENT.md", "How it is deployed"),
        ("TESTING.md", AM / "TESTING.md", "Tests and how to run them"),
        ("Changelog", AM / "docs/changelog/README.md", "One line per release"),
        ("ISO 27001 mapping", AM / "docs/compliance/ISO27001.md", "Annex A mapping, gaps, evidence"),
        ("Disaster recovery", AM / "docs/compliance/DISASTER_RECOVERY.md", "Backups, RPO/RTO, runbooks"),
        ("Platform docs index", AM / "docs/platform/README.md", "Cross-project platform docs"),
        ("Platform auth", AM / "docs/platform/PLATFORM_AUTH.md", "Sign-in across all projects"),
        ("Source projects", AM / "docs/platform/SOURCE_PROJECTS.md", "What the source projects are"),
        ("Modules proposal", AM / "docs/platform/PLATFORM_MODULES_PROPOSAL.md", "Module portal / per-module licensing"),
        ("AI infrastructure", AM / "docs/platform/ORCANOS_AI_INFRASTRUCTURE.md", "Hosting, regions, AI stack"),
        ("AI transformation plan", AM / "docs/platform/ORCANOS_AI_TRANSFORMATION_PLAN.md", "The bigger plan"),
        ("One-LLM proposal", AM / "docs/platform/PLATFORM_ONE_LLM_PROPOSAL.md", "One AI engine for all apps"),
        ("Regions change 2026-09-09", AM / "docs/platform/CHANGES-2026-09-09-REGIONS.md", "US/EU split"),
        ("release_notes.json", AM / "release_notes.json", "What the app's release-notes window shows"),
        ("deploy.bat (menu)", AI / "compliance-platform/deploy.bat", "Deploy button — picks an app"),
    ]),
    ("Traceability — start here", "tm", [
        ("CLAUDE.md", TM / "CLAUDE.md", "Orientation, Critical Notes index, open work per module (v5.0.0)"),
        ("FILE_MAP.md", TM / "design/docs/FILE_MAP.md", "Which file does what"),
        ("API.md", TM / "design/docs/API.md", "Every HTTP route"),
        ("Docs index (as built)", TM / "design/docs/README.md", "How each shipped module works"),
        ("Critical notes folder", TM / "design/docs/notes", "The traps, by area"),
        ("Changelog", TM / "design/docs/changelog/README.md", "One line per release"),
        ("Security controls", TM / "design/docs/SECURITY_CONTROLS.md", "Controls + known gaps (for customers)"),
        ("Disaster recovery", TM / "design/docs/DISASTER_RECOVERY.md", "Backup + restore"),
        ("ARCHITECTURE.md", TM / "ARCHITECTURE.md", "System design"),
        ("SCHEMA.md", TM / "SCHEMA.md", "Database tables"),
        ("DEPLOYMENT.md / INSTALL.md", TM / "DEPLOYMENT.md", "Fly + IIS deployment"),
        ("QUICKSTART.md", TM / "QUICKSTART.md", "Run it locally"),
        ("HANDOVER.html", TM / "HANDOVER.html", "Handover page"),
        ("Ideas.md", TM / "Ideas.md", "Idea backlog"),
        ("release_notes.json", TM / "release_notes.json", "In-app release notes (5.0.0)"),
        ("Deck order (index.json)", TM / "marketing/presentations/_index/index.json", "Groups + order of the deck viewer"),
        ("Design folder", TM / "design", "What we intended to build (DESIGN_*.md)"),
    ]),
    ("Traceability — modules (as built · handover §0)", "tm", [
        ("Home page", TM / "design/docs/HOME.md", "Landing to-do, AI advisor, read-and-sign"),
        ("Traceability Dashboard", TM / "design/docs/TRACE_DASHBOARD.md", "Score, coverage, baselines"),
        ("DHF", TM / "design/docs/DHF.md", "Design History File from a trace panel"),
        ("Document branches", TM / "design/docs/DOC_VARIANTS.md", "Fork, compare, merge DHF documents"),
        ("Import from Documents", TM / "design/docs/DOC_IMPORT.md", "AI: customer docs → items + traces"),
        ("Risk Management", TM / "design/docs/RISK_MANAGEMENT.md", "FMEA, Risk Studio, import"),
        ("Document Control", TM / "design/docs/DOC_CONTROL.md", "DMS library, revisions, signing"),
        ("Doc Review", TM / "design/docs/DOC_REVIEW.md", "Review DMS drafts before routing"),
        ("Training traceability", TM / "design/docs/TRAINING_TRACEABILITY.md", "Training panels + quizzes"),
        ("Supplier Portal", TM / "design/docs/SUPPLIER_PORTAL.md", "SCARs, reviews, certificates"),
        ("BOM Viewer", TM / "design/docs/BOM_VIEWER.md", "Hardware BOM viewer"),
        ("Product structures", TM / "design/docs/BOM_STRUCTURES.md", "BOM hierarchy, baselines, branches"),
        ("Software BOM", TM / "design/docs/SBOM.md", "SBOM, vulnerabilities, VEX"),
        ("Integrations", TM / "design/docs/INTEGRATIONS.md", "Jira, GitHub, Azure DevOps"),
        ("Report booklets", TM / "design/docs/BOOKLETS.md", "Booklets + Present mode"),
        ("Reports", TM / "design/docs/REPORTS.md", "Instant reports"),
        ("Multi-language", TM / "design/docs/I18N.md", "Translations, RTL, glossary"),
    ]),
    ("Traceability — validation & release", "tm", [
        ("Validation project", TM / "validation/VALIDATION_PROJECT.md", "Start here — decisions, status"),
        ("Validation README", TM / "validation/README.md", "URS / SRS / tests layout"),
        ("Open issues", TM / "validation/OPEN_ISSUES.md", "What to do next, in order"),
        ("Last results", TM / "validation/LAST_RESULTS.md", "Per-test state"),
        ("Format", TM / "validation/FORMAT.md", "File format of URS/SRS/tests"),
        ("Process flow", TM / "validation/PROCESS.html", "validation.bat → sign → deploy.bat"),
        ("Release Console", TM / "tools/release_console/README.md", "manage.bat app on port 8030"),
    ]),
    ("Traceability — user manual (source)", "tm", [
        ("Getting started", TM / "user-manual/USER_MANUAL.md", "Main manual"),
        ("Traceability Matrix", TM / "user-manual/TRACEABILITY.md", ""),
        ("DHF", TM / "user-manual/DHF.md", ""),
        ("Risk", TM / "user-manual/RISK.md", ""),
        ("Document Control", TM / "user-manual/DOCUMENT_CONTROL.md", ""),
        ("Doc Review", TM / "user-manual/DOC_REVIEW.md", ""),
        ("Training", TM / "user-manual/TRAINING.md", ""),
        ("Supplier Portal", TM / "user-manual/SUPPLIER_PORTAL.md", ""),
        ("BOM Viewer", TM / "user-manual/BOM_VIEWER.md", ""),
        ("Software BOM", TM / "user-manual/SBOM.md", ""),
        ("Integrations", TM / "user-manual/INTEGRATIONS.md", ""),
        ("Help & Reference", TM / "user-manual/REFERENCE.md", ""),
        ("Tutorials", TM / "user-manual/TUTORIALS.md", "Generated — don't edit by hand"),
    ]),
    ("Ask Paul (Orcanos QMS)", "qms", [
        ("CLAUDE.md", QMS / "CLAUDE.md", "Start here — Ask Paul instructions"),
        ("AGENTS.md", QMS / "AGENTS.md", "Agents"),
        ("START_HERE.md", QMS / "MD files/START_HERE.md", "Orientation"),
        ("SYSTEM.md", QMS / "MD files/SYSTEM.md", "System overview"),
        ("ARCHITECTURE.md", QMS / "MD files/ARCHITECTURE.md", "Design"),
        ("SCHEMA.md", QMS / "MD files/SCHEMA.md", "Database"),
        ("PATTERNS.md", QMS / "MD files/PATTERNS.md", "Code patterns"),
        ("UI.md", QMS / "MD files/UI.md", "UI rules"),
        ("COMPLIANCE.md", QMS / "MD files/COMPLIANCE.md", "Compliance features"),
        ("FDA 510(k)", QMS / "MD files/FDA_510K.md", "510(k) module"),
        ("MDSAP", QMS / "MD files/MDSAP.md", "MDSAP module"),
        ("Standards module", QMS / "MD files/STANDARDS_MODULE.md", "Standards"),
        ("Rule extraction", QMS / "MD files/RULE_EXTRACTION.md", ""),
        ("Security fixes", QMS / "MD files/SECURITY_FIXES.md", ""),
        ("Design index", QMS / "design/README.md", "Design / plans folder"),
        ("release_notes.json", QMS / "release_notes.json", "Ask Paul release notes"),
        ("Test failures to fix", QMS / "TEST_FAILURES_TO_FIX.md", "Open test failures"),
        ("User manual", QMS / "user-manual/USER_MANUAL.md", "Source of the GitBook manual"),
        ("Admin guide", QMS / "user-manual/ADMIN.md", ""),
        ("Expert agents (JSON)", QMS / "skills", "Ask Paul's expert personas"),
    ]),
    ("Policies & handbook (ISMS PDFs)", "pol", [
        ("Employee Handbook & Acceptable Use", QMS / "docs/Employee Handbook & Acceptable Use Policy - Orcanos_E_1.pdf", "The handbook"),
        ("ISMS Policy", QMS / "docs/Orcanos ISMS Policy_F_1.pdf", "Top-level ISMS policy"),
        ("Information Security Policy", QMS / "docs/Information Security Policy - Orcanos_D_1.pdf", ""),
        ("Privacy Policy", QMS / "docs/Privacy Policy - Orcanos_E_1.pdf", ""),
        ("Incident Response", QMS / "docs/Incident Response Policy - Orcanos_E_1.pdf", ""),
        ("Backup & Disaster Recovery", QMS / "docs/Backup & Disaster Recovery Plan - Orcanos_D_1.pdf", ""),
        ("Secured SDLC", QMS / "docs/Secured SDLC Policy - Orcanos_D_1.pdf", ""),
        ("All policies folder", QMS / "docs", "Every ISMS policy PDF"),
        ("ISO 27001 project", AI / "iso 27001", "ISO 27001 working folder"),
    ]),
    ("Marketing", "mkt", [
        ("Marketing README", TM / "marketing/README.md", "Where every piece lives"),
        ("Presentations README", TM / "marketing/presentations/README.md", "Deck catalog, design, usage tracking"),
        ("Presentation skill", TM / ".claude/skills/presentation.md", "How to make/update a deck"),
        ("Landing page", TM / "marketing/landing/index.html", "Compliance Suite landing page"),
        ("Newsletters README", TM / "marketing/newsletters/README.md", ""),
        ("October newsletter", TM / "marketing/newsletters/October Newsletter.html", ""),
        ("SBOM product update", TM / "marketing/newsletters/SBOM Product Update (preview).html", "E-mail (preview, local images)"),
    ]),
    ("Claude skills", "sk", [
        ("Skills repo (CLAUDE.md)", AI / "Claude-skills/CLAUDE.md", "Publishable skills library + installers"),
        ("Skills repo README", AI / "Claude-skills/README.md", ""),
        ("Global skills folder", SKILLS, "~/.claude/skills — what Claude loads"),
        ("Global CLAUDE.md", Path.home() / ".claude/CLAUDE.md", "Rules for all projects"),
        ("Traceability memory", Path.home() / ".claude/projects/c--AI-Projects-traceability-matrix/memory/MEMORY.md", "Claude's memory index for this project"),
    ]),
]

DECKS = [  # (group, title, file, blurb)
    ("Start here", "Compliance Suite", "suite/Orcanos-Compliance-Suite.html", "The whole suite in one tour"),
    ("Start here", "Thinking AI", "thinking-ai/Orcanos-Thinking-AI.html", "How Orcanos thinks differently about AI"),
    ("Design Control / ALM", "Traceability Matrix", "traceability-matrix/Orcanos-Traceability-Matrix.html", "Requirement-to-test chains, gaps, dashboard"),
    ("Design Control / ALM", "DHF", "dhf/Orcanos-DHF.html", "Design History File, scored and placed"),
    ("Design Control / ALM", "Document Branches", "document-branches/Orcanos-Document-Branches.html", "Editions per market, compare and merge"),
    ("Design Control / ALM", "Risk Management", "risk-management/Orcanos-Risk-Management.html", "FMEA, controls and risk import"),
    ("BOM", "BOM", "bom/Orcanos-BOM.html", "Shared sub-assemblies, baselines, branches"),
    ("BOM", "Software BOM", "software-bom/Orcanos-Software-BOM.html", "SBOM, vulnerabilities, VEX"),
    ("QMS", "Supplier Portal", "supplier-portal/Orcanos-Supplier-Portal.html", "SCARs, supplier reviews, certificates"),
    ("Compliance AI", "Ask Paul", "ask-paul/Orcanos-Ask-Paul.html", "Chat, agents, 510(k), MDSAP"),
    ("Platform & talks", "Platform Architecture", "platform-architecture/Orcanos-Platform-Architecture.html", "How it is built, hosted and secured"),
    ("Platform & talks", "AI in a Validated World", "ai-regulated-dev/Orcanos-AI-Validated-World.html", "Webinar: shipping AI in a validated world"),
]



def skill_desc(md: Path) -> str:
    try:
        text = md.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""
    m = re.search(r"^description:\s*(.+)$", text, re.M)
    d = m.group(1).strip().strip('"\'') if m else ""
    d = re.split(r"(?<=[.!?])\s", d)[0]
    return d[:160] + ("…" if len(d) > 160 else "")


def href(target) -> tuple[str, bool]:
    if isinstance(target, str):
        return target, True
    p = Path(target)
    if not p.exists():
        return p.as_uri(), False
    return R.link(p, prefix="index_pages/"), True


def item(title, target, note, tag=""):
    url, ok = href(target)
    ext = "" if isinstance(target, str) else (Path(target).suffix.lstrip(".").upper() or "FOLDER")
    badge = f'<span class="b">{html.escape(ext)}</span>' if ext else '<span class="b web">WEB</span>'
    cls = "" if ok else " missing"
    tgt = ' target="_blank" rel="noopener"' if isinstance(target, str) else ""
    n = f'<span class="n">{html.escape(note)}</span>' if note else ""
    return (f'<li class="it{cls}" data-s="{html.escape((title + " " + note + " " + tag).lower())}">'
            f'<a href="{html.escape(url)}"{tgt}>{html.escape(title)}</a>{badge}{n}</li>')


def section(title, items, sid):
    return (f'<section id="{sid}"><h2>{html.escape(title)}</h2><ul>' + "".join(items) + "</ul></section>")


def build():
    parts, nav = [], []
    for i, (title, _, rows) in enumerate(SECTIONS):
        sid = f"s{i}"
        nav.append((sid, title))
        parts.append(section(title, [item(t, p, n, title) for t, p, n in rows], sid))
        if i == 0:  # decks right after live apps
            groups = {}
            for g, t, f, b in DECKS:
                groups.setdefault(g, []).append(item(t, TM / "marketing/presentations" / f, b, "deck " + g))
            inner = "".join(f'<h3>{html.escape(g)}</h3><ul>{"".join(v)}</ul>' for g, v in groups.items())
            nav.append(("decks", "Presentations"))
            parts.append(f'<section id="decks"><h2>Presentations (local files)</h2>{inner}</section>')

    sk = []
    for d in sorted(p for p in SKILLS.iterdir() if p.is_dir() and p.name != "synced"):
        md = next((d / n for n in ("SKILL.md", "skill.md") if (d / n).exists()), None)
        sk.append(item(d.name, md or d, skill_desc(md) if md else "", "skill"))
        subs = [f for f in sorted(d.glob("*.md")) if f.name.lower() != "skill.md"]
        if subs:
            links = " · ".join(f'<a href="{R.link(f, prefix="index_pages/")}">{html.escape(f.stem)}</a>' for f in subs)
            sk.append(f'<li class="sub" data-s="{html.escape(d.name + " " + " ".join(f.stem for f in subs)).lower()}">{links}</li>')
    nav.append(("skills", "Skills list"))
    parts.append(section(f"Global skills ({len([s for s in sk if 'class=\"it' in s])})", sk, "skills"))

    n = R.render_all()
    print(f"Rendered {n} pages into {R.out}")
    navhtml = "".join(f'<a href="#{s}">{html.escape(t)}</a>' for s, t in nav)
    OUT.write_text(TEMPLATE.replace("{{NAV}}", navhtml).replace("{{BODY}}", "".join(parts)), encoding="utf-8")
    print(f"Wrote {OUT}")


TEMPLATE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Projects Index</title>
<style>
:root{--bg:#f7f7fb;--card:#fff;--ink:#1d1b2e;--mute:#6b6880;--line:#e6e4f0;--acc:#6b3fd4;--badge:#efeafc}
@media (prefers-color-scheme:dark){:root{--bg:#14131c;--card:#1d1c28;--ink:#ecebf5;--mute:#9a97b0;--line:#2d2b3c;--acc:#a78bfa;--badge:#2a2540}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,Segoe UI,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px}
h1{margin:0 0 8px;font-size:20px}h1 small{color:var(--mute);font-weight:400;font-size:13px;margin-left:8px}
#q{width:100%;max-width:420px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:14px}
nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}nav a{font-size:12px;padding:3px 9px;border-radius:999px;background:var(--badge);color:var(--acc);text-decoration:none}
main{padding:16px;columns:3 380px;column-gap:16px}
section{break-inside:avoid;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 16px}
h2{font-size:15px;margin:0 0 8px;color:var(--acc)}h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute);margin:10px 0 4px}
ul{list-style:none;margin:0;padding:0}.it{padding:4px 0;border-bottom:1px dashed var(--line)}.it:last-child{border:0}
a{color:var(--ink);font-weight:600;text-decoration:none}a:hover{color:var(--acc);text-decoration:underline}
.b{font-size:10px;margin-left:6px;padding:1px 5px;border-radius:4px;background:var(--badge);color:var(--mute);font-weight:600}
.b.web{color:var(--acc)}.n{display:block;color:var(--mute);font-size:12.5px}
.sub{font-size:12px;padding:0 0 6px 10px}.sub a{font-weight:400;color:var(--mute)}
.missing a{text-decoration:line-through;color:var(--mute)}.hide{display:none}
footer{color:var(--mute);font-size:12px;padding:0 16px 20px}
</style></head><body>
<header><h1>AI Projects Index<small>local links · regenerate with <code>python scripts/build_index.py</code></small></h1>
<input id="q" placeholder="Search titles and summaries…" autofocus><nav>{{NAV}}</nav></header>
<main>{{BODY}}</main>
<footer>Struck-through = file not found when the page was built. MD, JSON, code files and folders open as readable pages (built into index_pages/); each page has an <b>Open in VS Code</b> button.</footer>
<script>
const q=document.getElementById('q');q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();
document.querySelectorAll('li').forEach(li=>li.classList.toggle('hide',v&&!li.dataset.s.includes(v)));
document.querySelectorAll('section').forEach(s=>s.classList.toggle('hide',v&&!s.querySelector('li:not(.hide)')));});
</script></body></html>"""

if __name__ == "__main__":
    build()
