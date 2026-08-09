# Task 0 report — 设备端 agent elicitation 探测

## Status: DONE

## Deliverable

`.superpowers/sdd/sp14/task-0-backend-probe.md` — created and committed at `1212485`
(`docs(sp14): record whether the device agent speaks MCP elicitation`).

## Conclusion

**不支持 (not supported).** The agent container currently deployed on this device
predates the MCP elicitation feature — this is not a "couldn't tell" outcome, it is
a settled negative backed by three independent pieces of evidence, all recorded
verbatim in the probe file.

## What was found

1. `docker` needed `sudo -n` (passwordless sudo worked in this session; bare `docker
   ps` failed with a socket permission error). Container: `nimoos-agent-agent-1`
   (`localhost/nimoos-agent:bundled`).
2. The brief's `/app` path inside the container does not exist. `docker inspect`
   showed the real `WorkingDir` is `/usr/share/nimoos/agent`, baked into the image
   (not a bind mount — the only mounts are `/DATA`, `/media`, `/mnt`, and the
   `/var/lib/nimoos/ai/*` + `/var/run/nimoos` data/socket dirs). Grepping the *real*
   run directory for `mcp_elicit_form`, `mcp_elicit_url`, and the bare word `elicit`
   all returned zero matches. `mcp_client/` in the container has no
   `elicitation.py` / `elicitation_schema.py` at all (only `client.py`, `runtime.py`,
   `schema.py`, `netns_stdio.py`, `__init__.py`).
3. Corroboration, not guesswork: the container image was built 2026-07-18 (same day
   as the on-device `/usr/bin/nimoos-ai` Go binary). The local repo's
   `agent/mcp_client/elicitation.py` was added 2026-08-06 by commit `c5f91ba`
   (PR #85, "Mcp 2.0 upgrade") — after the image build. The container's installed
   `mcp` SDK is `1.28.1`; the local repo's `requirements.txt` now pins
   `mcp>=2.0.0,<3`. Three independent signals (grep, build date, SDK version) agree.

One footgun worth flagging for whoever reads the probe file later: a naive
`grep -r ... /` (no path restriction) inside the container silently picks up
`/DATA/.system_data/home/nimo/NimoTech/...` — the host's `/DATA` is bind-mounted
into the container, and the host happens to keep a mirror of the dev checkout
under `.system_data`. That mirror does contain the elicitation code, and reading
that hit without checking `WorkingDir` first would produce the wrong (支持)
conclusion. This is called out explicitly in the probe file so Task 10 doesn't
repeat the mistake.

## Concern (unrelated to the elicitation question, but real)

`.superpowers/sdd/.gitignore` in this worktree (and in `master`) is a bare `*`.
All the historical task ledgers under `.superpowers/sdd/` are only visible to git
because they were already tracked before that line existed (the classic
"tracked-but-ignored" situation this repo has hit before). The **entire**
`.superpowers/sdd/2026-08-08-vue3-migration-sp14-ai-catchup/` directory — including
`task-0-brief.md` itself and `progress.md` — is untracked and currently invisible
to plain `git add`; I had to use `git add -f` to commit my own deliverable. Unless
someone force-adds the rest of that directory too, every subsequent sp14 task's
brief/report will silently fail to enter git the same way SP7's ledger loss and
SP9-P7's "P5/P6 ledgers never made it into the roadmap" incidents happened before.
I did not fix this myself since it's outside Task 0's scope (only one file was
asked for), but it should get a deliberate `git add -f` pass before this stage
goes much further.

## Commit

`1212485` on branch `sp14-ai-catchup`.
