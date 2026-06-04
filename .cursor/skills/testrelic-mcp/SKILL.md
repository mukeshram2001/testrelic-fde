---
name: testrelic-mcp
description: >-
  Use TestRelic MCP tools (tr_*) for test creation, coverage gaps, auto-healing,
  and triage. Load when the task involves TestRelic test data or AI test tooling.
---

# TestRelic MCP — quick reference

## Auth
- MCP token: tr_mcp_* PAT from Settings → MCP Tokens
- SDK key: TESTRELIC_API_KEY from Settings → API Keys
- These are separate; never substitute one for the other.

## Orientation — always start here
1. tr_list_repos — find repo_id (UUID); empty = token/bootstrap issue
2. tr_health — verify server is running and caps are enabled

## Key tools by goal
- Coverage gaps: tr_coverage_gaps → tr_plan_test → tr_generate_test → tr_dry_run_test
- Triage + fix: tr_diagnose_run → tr_user_impact → tr_ai_rca → tr_heal_run
- PR gating: tr_analyze_diff → tr_select_tests → tr_risk_score

## MCP prompts (prefer these over manual tool chains)
- /create_test_from_gap project_id=<uuid> — full gap→test→dry-run flow
- /triage_and_heal run_id=<uuid>          — diagnose→impact→rca→heal
- /pr_impact_gate project_id=<uuid> unified_diff=<diff> — MUST/SHOULD/OPTIONAL

## MCP resources (read-only)
- testrelic://repos/{repo_id}/journeys
- testrelic://repos/{repo_id}/coverage-report
- testrelic://repos/{repo_id}/gaps
- testrelic://cache/{key}  ← full payload when a tool result was truncated

## Bootstrap failure
If tr_list_repos returns empty: pass project_id explicitly on every tool call,
or add --default-repo-id <uuid> to the MCP config args.

## Truncation recovery
Tool results are capped at 4000 tokens. Check structuredContent.cacheKey and
call tr_fetch_cached or fetch testrelic://cache/{key} for the full payload.

## Deprecated aliases
If a tool description says [DEPRECATED — use X], call X only.

## Transport
- Local/Cursor: use stdio (npx command above)
- Team/CI: use HTTP url (e.g. https://mcp-stage.testrelic.ai/mcp)
