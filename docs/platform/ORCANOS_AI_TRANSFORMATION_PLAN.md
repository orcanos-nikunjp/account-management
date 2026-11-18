# Orcanos AI — Transformation Plan

| | |
|---|---|
| **Owner** | Zohar |
| **Version** | Draft 1 · 2026-11-15 — kick-off in Israel, 18–24 Nov 2026 |
| **Horizon** | Nov 2026 → Mar 2027, reviewed monthly |
| **Master copy** | Google Doc: https://docs.google.com/document/d/1OTNKscJHJhoc3_zGMQKGyVnk-Cihwy7ktEwIcELx1Ig/edit — this file is a snapshot of 2026-11-15 |
| **Built from** | *Orcanos AI roadmap Nov 2026*, *Orcanos AI Strategy* (older — goals and roles reused), the handbook [`ORCANOS_AI_INFRASTRUCTURE.md`](ORCANOS_AI_INFRASTRUCTURE.md) |

---

## 1. The goal in one paragraph

Orcanos becomes an AI-first company: **Orcanos AI** ("Powered by Orcanos") with its own name, website and automated marketing.
Our AI tools run on **Orcanos AWS** (US + EU) and open from inside Orcanos. R&D writes code, tests and documents with Claude
as the normal way of working, and every release is tested, validated and signed automatically.

### What "done" looks like by end of March 2027

| # | Outcome | Measured by |
|---|---|---|
| 1 | Traceability tool live on AWS US + EU, opened from Orcanos | Customers on `hub` / `ushub`; Fly switched off |
| 2 | One release pipeline: branch → PR → staging → validated → tagged → EU + US | Every prod release has a signed validation pack in Orcanos |
| 3 | Ask Paul on AWS | Running on AWS, Cloud Run/Vercel retired |
| 4 | R&D works with Claude on Orcanos core | First core change shipped with Claude (Dec); ≥70% of new code AI-assisted (Mar) |
| 5 | REST API for every SOAP call Claude needs | REST list complete and documented as skills |
| 6 | Test automation on Playwright replaces Ghost Inspector | % of Ghost Inspector suites ported (target 80% by Mar) |
| 7 | Orcanos AI brand + automated website, newsletters, marketing hub | Site live, one newsletter a month sent by the pipeline |
| 8 | Onboarding / support agent (Professional Services) | Pilot with 2 customers |

---

## 2. People

| Person | Where | Role in this plan |
|---|---|---|
| **Zohar** | US (Israel 18–24 Nov) | Owner. The **only** person changing the Traceability tool for now. Skills owner, trainer |
| **Nikunj** | India | **AI team lead.** DB migration, AWS deployment, release pipeline, dev environment |
| **Ravi** | India | AI developer — Postgres support in the trace tool, then REST API (Project #1) |
| **Beenal** | India | AI developer — deployment pipeline / CI, then Ask Paul move |
| **Amita** | India | QA lead. One tester full-time on AI tools for a month; owns Playwright automation (Project #4) |
| **Gil** | Israel | R&D manager. Owns infrastructure support, Claude roll-out to all R&D, prod deploy approver |
| **Yoni** | Israel (part-time) | Product. Professional-services agent lead **if he accepts** — else open |
| **Ronen** | — | Author of the deployment process; reviews pipeline with Nikunj |

> **To confirm in Israel:** the older strategy also named Rami (AI lead), Kfir (infra/marketing), Shir (PS tools),
> Rakesh (Fin.AI). Decide who stays in this plan and in what role — see §6.

**Prod deploy rights:** Zohar, Nikunj, Gil only.

---

## 3. Before I land (by Tue 17 Nov)

| # | Task | Owner |
|---|---|---|
| P1 | Every attendee has Claude (licence + Claude Code installed), GitHub access to `traceability-matrix`, and the skills repo cloned | Gil / Nikunj |
| P2 | Latest code pushed to GitHub and pulled by Nikunj | Zohar → Nikunj |
| P3 | **Fresh EU + US database copies** ready for the migration ⚠️ see note | Zohar |
| P4 | PostgreSQL installed on Zohar's machine | Zohar |
| P5 | AWS: staging EU (`stage.orcanos.com/traceability/`) reachable, access for Nikunj, Ravi, Beenal | Gil / Nikunj |
| P6 | Each attendee reads handbook §15 (how we work with Claude Code) and §16 (skills) | All |

> ⚠️ **P3 — customer data.** The DBs hold customer data, and the EU DB is under our EU residency promise (handbook §5).
> Sending it to a Google Drive folder opened to India is a data transfer we must be able to defend. Decide before
> sharing: an **anonymised copy** for development, real copies only on the AWS region they belong to.

---

## 4. Israel week — 18–24 Nov

Times: **EST / Israel / India**. Sessions are hybrid — Gil + Yoni in the room, India on Zoom.

| Day | Time (EST · IL · IN) | Session | Who | Leaves with |
|---|---|---|---|---|
| **Wed 18** | 02:00–05:30 · 09:00–12:30 · 12:30–16:00 | **#1 Traceability tool on AWS** — architecture tour, SQLite → Postgres plan (dual-engine with a config switch), environments, who does what | Zohar, Nikunj, Ravi, Beenal, Gil, Amita | Migration plan + table classes (handbook §10.3); task list in owners' names; trace tool running locally on each dev machine |
| **Wed 18** | 05:30–07:30 · 12:30–14:30 · 16:00–18:00 | **#2 Release + validation automation** — Ronen's pipeline, the validation tool, deploy gate, where results land in Orcanos | Zohar, Nikunj, Beenal, Amita, Gil | Pipeline drawn and agreed; validation gate rule decided; Zohar trained on the release tool |
| Wed 18 | 08:30 · 15:30 | Shamir — Orcanos AI | Zohar | — |
| **Thu 19** | 02:00–07:00 · 09:00–14:00 · 12:30–17:30 | **#3 AI on Orcanos core** — Claude on every machine, session loop, skills, CLAUDE.md for the core repo; pick the REST API list (Project #1) and the first Claude change (Project #3) | All R&D | Claude working on every machine; core `CLAUDE.md` v0; REST API backlog; first change chosen |
| Thu 19 | 03:00 EST | ⚠️ *Traceability group education session-3* overlaps #3 — move it or hand it over | Zohar | — |
| Sun 22 | Israel day | **Gil + Yoni, in person** — brand (Orcanos AI), website, marketing hub, PS agent, roles | Zohar, Gil, Yoni | Decisions §6 answered; PS agent owner |
| **Mon 23** | 02:00–05:00 · 09:00–12:00 · 12:30–15:30 | **#4 End-to-end cycle + switch to production** — one real change: branch → PR → staging → validation → tag → EU + US | Zohar, Nikunj, Beenal, Amita, Gil | First release through the pipeline (staging at least); go/no-go date for production |
| Tue 24 | Israel day | Wrap-up — review this plan, fix owners and dates, set the weekly rhythm | Zohar, Gil (+ India on Zoom) | Plan v2 published |

---

## 5. Timeline — Nov 2026 → Mar 2027

### Track A — Traceability tool on AWS (Nikunj, Ravi, Beenal · Amita for verification)

| When | Milestone |
|---|---|
| Nov wk 4 | Postgres support behind a config switch (SQLite stays default); runs locally on Postgres |
| Nov wk 4 | EU + US DB copies migrated to Postgres; integrity checks (row counts per table, sample panels, users, quizzes, signatures) |
| Dec wk 1 | Running on EU staging; Amita's tester runs the validation suite there |
| Dec wk 2 | Opened from Orcanos (launch from inside Orcanos, login hand-off) |
| Dec wk 3 | **Production EU** (`hub.orcanos.com/traceability/`) then **US** (`ushub.orcanos.com/traceability/`); Fly kept as fallback for 2 weeks, then off |
| Dec | Account Management supports both environments (Zohar) |

### Track B — Release pipeline + validation (Nikunj, Beenal, Amita)

| When | Milestone |
|---|---|
| Nov wk 4 | Pipeline documented: branch + PR → merge to main → auto-deploy to staging → V&V → version tag → same image to EU + US |
| Dec wk 1 | Tests + validation run automatically before prod; failing validation **blocks** the deploy |
| Dec wk 2 | Each release: validation pack linked to the version, results + approvals saved to Orcanos |
| Phase 2 (Jan) | Rollback to the previous production version |

### Track C — AI on Orcanos core (Gil owns, all R&D)

| Project | When | Owner |
|---|---|---|
| Claude installed + trained, all R&D | Nov | Gil |
| Shared skills repo (Zohar's skills + team contributions) | Nov → ongoing | Zohar, Nikunj |
| **#1** REST API for every SOAP call | Nov → Dec | Ravi (+ core dev) |
| **#2** Teach Claude Orcanos core step by step (processes, architecture, flows, DB) | Nov → Jan | Gil, Zohar |
| **#3** First core change made with Claude | Dec | Gil picks it |
| **#4** Playwright test automation from Ghost Inspector | Nov → Mar | Amita |
| **#5** Automated new account + upgrade pipeline | Dec | Nikunj |
| **#6** Rebuild help + documentation in GitBook | Mar | Yoni / Zohar |

### Track D — Ask Paul to AWS (Beenal, after Track A)

| When | Milestone |
|---|---|
| Jan | Already Postgres + single-tenant → move to AWS RDS + pgvector; copy embeddings, don't regenerate (handbook §21.5) |
| Feb | Live on AWS, old hosting off |

### Track E — Orcanos AI brand + marketing (Zohar + Gil · decide owner in Israel)

| When | Milestone |
|---|---|
| Dec | Name + "Powered by Orcanos" decided; website built with AI |
| Jan | Marketing hub connected; newsletter pipeline (monthly) |

### Track F — Professional services agent (Yoni if he accepts)

| When | Milestone |
|---|---|
| Dec | Map today's onboarding problems; collect existing material |
| Jan–Feb | Agent v1: explains onboarding, asks questions, own database |
| Mar | Pilot with 2 customers; then actions (e.g. data migration) |

---

## 6. Decisions to take in Israel

| # | Decision | Who | Default if not decided |
|---|---|---|---|
| D1 | Roles from the older strategy (Rami, Kfir, Shir, Rakesh) — in or out of this plan? | Zohar, Gil | Out until named |
| D2 | Postgres: whole DB, or only config + records with cache left local (handbook §10.3)? | Zohar, Nikunj | Whole DB, dual-engine switch |
| D3 | Can real customer DBs leave their region for development? | Zohar, Gil | No — anonymised copy only |
| D4 | Does failed validation always block production? | Zohar, Gil, Amita | Yes; emergency override logged |
| D5 | Who owns brand + website + marketing (Track E)? | Zohar, Gil | Zohar |
| D6 | Yoni leads Professional Services? | Yoni | Track F waits |
| D7 | How many QA hours on AI after the first month? | Gil, Amita | Review end of December |

---

## 7. How we run it

- **Weekly 30-min sync** (Israel + India), same slot every week: status per track, blockers, next week.
- **Each track has one owner and a dated task list** — kept in Orcanos (or GitHub issues; decide in the first week).
- **Working rules** (handbook §15): plan in chat, build in Claude Code; one task per session; test before commit;
  nothing to production without the pipeline. Only Zohar changes the Traceability tool code until the team is ready.
- **Monthly review** of this plan against §1 — change dates here, not in chat.
- **AI cost** tracked per developer and per product (Anthropic console + our credits ledger).

---

## 8. References

- Handbook: [`ORCANOS_AI_INFRASTRUCTURE.md`](ORCANOS_AI_INFRASTRUCTURE.md) — §10.3 SQLite → Postgres, §15 Claude Code, §16 skills,
  §18 CI/CD, §21 AWS, §22 next steps
- Traceability repo `CLAUDE.md`; validation: `traceability-matrix/validation/VALIDATION_PROJECT.md`; release console:
  `traceability-matrix/tools/release_console/README.md`
- Environments: staging EU `stage.orcanos.com/traceability/` · prod EU `hub.orcanos.com/traceability/` ·
  prod US `ushub.orcanos.com/traceability/`
