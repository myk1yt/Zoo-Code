# Architect Task Report

## Task Summary

Designed the Option A split of five analyzed feature branches into clean, purpose-led upstream contributions. The result is six PRs because the combined-only provider cost fixes form an independently reviewable concern rather than belonging implicitly to the large Stats PR.

## Actions Taken

1. Re-read the authoritative branch analysis and exact overlap matrix.
2. Reconstructed filtered manifests from the analyzed immutable refs.
3. Validated the three Shell commits, three DnD commits, 41 Stats commits, six MiMo-exclusive commits, and combined-only follow-up commits.
4. Assigned every shared contract and the 11 Stats × DnD overlaps to an explicit owner.
5. Assigned or rejected all 11 combined-only paths.
6. Defined UI ↔ typed IPC ↔ extension-host ↔ runtime/storage data flows and error rules.
7. Defined a dependency DAG, merge order, per-merge integration strategy, and per-PR exact verification commands.
8. Added a mandatory PR-body contract that begins with Problem, Why this PR, Scope, and Non-goals.
9. Ran a structural verification of the design: six PR sections, all eight required per-PR fields present six times, balanced code fences, all overall-plan sections present, and no remaining filename-like inline-code references.

## Result

**Success.** The completed design is in [the PR split design](pr-split-design.md:1).

The selected order is:

1. PR-1 Error and PR-2 Shell in parallel.
2. PR-3 DnD on the merged Shell/Error baseline.
3. PR-4 MiMo by replaying only its six exclusive commits on final Error and Shell.
4. PR-5 Stats after removing the duplicate task-organization port and integrating against all stable shared contracts.
5. PR-6 configured-price provider cost normalization after Stats.

Each PR now has an explicit WHY, exact include/exclude manifest, source evidence, dependency, conflict surface, complexity, and focused verification protocol.

## Issues Discovered

1. The combined-only provider follow-up is a separate concern. Folding it silently into Stats would weaken both PR rationales and make provider formulas harder to review.
2. Stats commit `191bf51e6` is explicitly a duplicate port of task-organization infrastructure. It must be omitted; PR-3 is the canonical owner.
3. Stats tip commit `9968e390d` combines provider costs and task-organization test fixes, so it must be reconstructed rather than cherry-picked wholesale.
4. Combined commit `fa8f19a6c` mixes provider tests with an unrelated terminal E2E timeout. Only provider tests belong in PR-6.
5. The codebase-index deletion remains absent from all analyzed refs and needs a separate research task.
6. Three environment/tool issues encountered during evidence collection are documented in [the environment feedback report](071433_architect-environment-feedback.md:1). None mutated product code.

## Next Step Recommendations

1. VP should run the mandatory Ask intent gate against [the design](pr-split-design.md:1), focusing on the six-PR topology and PR-6 separation.
2. Rewrite the execution brief from the exact manifests and ownership rules in [the implementation plan](pr-split-design.md:935).
3. Delegate PR-1 and PR-2 branch construction in parallel only after recording the refreshed upstream-main SHA.
4. Do not begin final PR-5 extraction until PR-2, PR-3, and PR-4 contracts are stable.
5. Route codebase-index deletion to an independent project-research task.

## Affected File List

- [PR split design](pr-split-design.md:1)
- [Architect report](072514_architect-report.md:1)
- [Environment feedback report](071433_architect-environment-feedback.md:1)
