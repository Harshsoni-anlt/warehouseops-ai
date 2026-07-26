# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Use GitHub's private reporting instead:
**[Report a vulnerability](https://github.com/Harshsoni-anlt/warehouseops-ai/security/advisories/new)**

Include the affected component, how to reproduce it, and the impact you think it
has. I'll acknowledge within a few days. This is a personal open-source project,
not a funded product — there's no bug bounty, but credit is given for anything
valid.

## Scope

This is a self-hosted demo application, designed to run on a developer's own
machine against their own data.

**It is not hardened for public internet deployment.** Specifically:

- Authentication is deliberately relaxed for local demo use — the console signs
  in automatically. Do not expose an instance to the internet as-is.
- `/chat` has no per-IP rate limiting. A public instance would let anyone
  exhaust your LLM provider quota.
- SQLite is single-writer and has no row-level access control.
- Uploaded documents are stored on the local filesystem, unencrypted.

If you plan to host this, treat the above as a to-do list rather than a surprise.

## Handling secrets

- `.env` is gitignored and must never be committed. `run.sh` creates it from
  `.env.example` and generates a random JWT secret per install.
- Get a Groq API key at [console.groq.com/keys](https://console.groq.com/keys).
  The free tier has no billing — hitting a limit returns HTTP 429 and cannot
  produce a charge — but treat the key as a credential regardless.
- To run with no external API calls at all, set `LLM_PROVIDER=ollama`.

## Dependency checks

```bash
python scripts/security/dependency_blocklist.py                     # check requirements.txt
python scripts/security/dependency_blocklist.py --check-installed   # check the venv
python scripts/security/dependency_blocklist.py --exit-on-violation # for CI
```

This blocks packages with code-execution capabilities that this project has no
reason to depend on, such as `langchain-experimental`.

## Inherited security work

This project is an adaptation of an open-source reference architecture (see
[NOTICE](NOTICE)). Mitigations carried over from the upstream work include
protections against CVE-2024-38459 (Python REPL execution), CVE-2024-28088
(LangChain Hub path traversal) and CVE-2025-27152 (Axios SSRF — the API client
sets `allowAbsoluteUrls: false`). LangGraph runs without a SQLite checkpointer,
avoiding CVE-2025-8709.
