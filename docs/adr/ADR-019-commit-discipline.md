# ADR-019: Commit Scope Discipline (Max 10 Files per Commit)

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-29 |
| Deciders | Engineering Team |

## Context

A single monolithic commit spanning 54 files was merged into the main branch. The commit combined new scrapers, utility refactors, API endpoint changes, mobile UI updates, documentation, and dependency additions. This made code review effectively impossible — reviewers could not reason about the interaction between changes across unrelated subsystems. It also made `git bisect` unreliable for isolating regressions, since any single "good" or "bad" commit contained dozens of unrelated changes.

## Decision

Each commit must target one logical concern. The maximum file count per commit is 10 (guideline, not a hard CI gate). Commit message prefixes must match the conventional-commits format required by this project:

```
feat(scope): description
fix(scope): description
chore: description
test(scope): description
docs(scope): description
refactor(scope): description
```

Recommended grouping order when landing a large batch of related work:
1. Utility foundations (`utils/`)
2. Backend core optimisations
3. New scrapers
4. ADR documents
5. Frontend/docs updates
6. Index / manifest updates

## Alternatives Considered

1. **Feature branch per change** — A branch-per-concern model provides full isolation but is operationally heavy for a small team making rapid iterative changes; the overhead of branch management, PR reviews, and merge conflicts outweighs the benefit at the current team size.
2. **Squash merge strategy** — Squashing all commits on a feature branch into one before merging preserves a clean main-branch history but eliminates the granular history on the feature branch, making it just as hard to bisect within a feature.
3. **No commit size rule** — The status quo before this ADR. Proved untenable with the 54-file commit incident.

## Consequences

**Positive:** Code review is tractable; `git bisect` can isolate regressions to a specific logical change; commit messages become meaningful changelog entries; rollback of a specific change is possible without reverting unrelated work.

**Negative / Trade-offs:** Developers must consciously stage and commit in logical groups rather than committing all modified files at once. Cross-cutting refactors (e.g., renaming a constant used in 20 files) may legitimately exceed 10 files — these are exceptions that should be noted in the commit message.

## Implementation Notes

- The 10-file guideline is enforced by convention and code review, not by a CI check (to allow legitimate exceptions).
- Commit messages must use the scopes defined in this project: `backend`, `mobile`, `web`, `docs`, `utils`, `scrapers`, `infra`.
- Pre-commit hooks should run `ruff`, `mypy`, and `pytest -x` to ensure each individual commit is green.
- When a cross-cutting change is unavoidable, prefix the commit message with `refactor(all):` and include a brief justification in the commit body.

## Compliance & Safety

- Audit trail integrity: granular commits make it possible to reconstruct which change introduced a safety-relevant modification (e.g., a change to `check_emergency` logic), supporting incident response and compliance audits.
- Commit history is part of the evidentiary record for any future regulatory review of AI-assisted medical feature changes.
