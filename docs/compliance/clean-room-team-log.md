# Clean-Room Team Log

## Context

The `libavoided-js` library was developed using AI-assisted tooling (Claude Code) under contributor direction. The traditional Spec Team / Implementation Team separation defined in `docs/clean-room-process.md` was not feasible for this workflow, because the same contributor directed both specification and implementation through an AI coding assistant.

## Alternative Controls

In lieu of team separation, the following controls were applied:

1. **No access to prohibited sources.** At no point during development were the libavoid (Adaptagrams) C++ source code, test suites, or any LGPL-licensed implementation code provided to, referenced by, or included in prompts to the AI assistant.

2. **Public-algorithm-only prompts.** All prompts described desired behavior and referenced only public algorithms (A*, Hanan grid, binary heap, Manhattan distance) and public format specifications (ELK JSON). See `docs/compliance/materials-log.md` for the complete list.

3. **Behavior-first specification.** The behavioral contract (`spec/router-behavior.md`) was defined from Coral product requirements and standard graph-routing concepts before implementation details were finalized.

4. **Independent naming and structure.** Module names, type names, file layout, and internal architecture were chosen independently. No external library's class hierarchy, file structure, or symbol names were replicated.

5. **Retroactive documentation.** Because the code was written before formal compliance artifacts existed, all artifacts in this directory were created retroactively by reviewing the implemented code against the process requirements. The code itself was not modified.

## Team Membership

| Role | Member | Start Date | Notes |
|------|--------|------------|-------|
| Contributor (Spec + Implementation) | [CONTRIBUTOR NAME] | [DATE] | Directed AI-assisted development; authored all prompts and reviewed all output. |
| AI Tooling | Claude Code (Anthropic) | [DATE] | Implementation mechanism; operated under contributor direction with no independent access to prohibited sources. |

## Acknowledged Deviation

The clean-room process prescribes separate Spec and Implementation teams (Section 1). This project used a single contributor directing an AI assistant for both roles. The alternative controls above are intended to provide equivalent protection against copying protected implementation expression. This deviation should be reviewed and accepted by compliance/legal review before release sign-off.
