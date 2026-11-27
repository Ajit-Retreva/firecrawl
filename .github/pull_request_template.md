## Linked ticket
## Assumptions
## Success criteria and how each was verified
- Verified against the real thing (ran it / read the actual value), not tests alone. (Rule 2)
## Blast radius (Rule 1)
- What else this change could break, beyond the diff:
- The one real check run to prove it's safe, and its result:
## Tests
- Tests assert observable behavior, not internals. (Rule 3)
- Bug fix: test that failed before the fix; root cause named, and any guard has a stated reason. (Rule 4)
## Scope
- One verifiable unit; removals have their own ticket. (Rule 5)
- Scripts/jobs: safe to run twice, same end state. (Rule 6)
- Shared files written: named single writer. (Rule 7)
- Any metric reported: how it was produced and its limits. (Rule 8)
## Unrelated issues noticed but not changed
