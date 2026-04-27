# Working Plan - 2026-04-27

This is a lightweight working plan for today only. It is intentionally not reconciled with older notes, ADR backlog items, or broader follow-up agendas yet.

## Focus For Today

Ship this version of the setup tool for both web and CLI by focusing on the parts that still affect release confidence most directly.

## Plan

1. Get the real setup-completion flow testable locally in web.
   - This is still the main blocker.
   - We need to be able to exercise the progress/completion path reliably enough to refine the last step against something real or near-real.

2. Refine the final setup/install state using the Figma Make flow as reference.
   - Move the release version closer to:
     - clear setup progress
     - minimal notices
     - clean final completion handoff
     - no extra gray wrappers or duplicated status text

3. Clean up the DNS help and first-step notices.
   - Use the Figma mockup as the reference shape.
   - Unify the domain help into one coherent block instead of splitting it across two places.

4. Mirror only the necessary final wording and behavior into CLI.
   - Keep parity where it matters for this release.
   - Do not reopen the broader flag or mode redesign unless it blocks release work.

5. End with a release audit and commit decision.
   - Verify the key flows.
   - Leave the broader flag and mode cleanup as post-release follow-up unless it becomes necessary for finishing today's work.

## Notes

- The broader command-line flag and mode story is still unsettled.
- That is not today's main focus unless it blocks testing or release confidence.
- The Figma Make prototype is the current reference for refining flow, setup notices, DNS help, and completion-state polish.
