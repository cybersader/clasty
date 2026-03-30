---
title: How to Contribute
description: Guide for contributing to Obsidian in Enterprise.
---

## Current Status

This project is **not yet open to code or documentation contributions** — it's in early POC phase and the architecture is still evolving. However, **discussions are very welcome**. If you have ideas, questions, or feedback about the approach, please join the conversation.

## How to Participate Now

### Discussions (Open)

- **Questions and ideas**: [Open a discussion](https://github.com/cybersader/openclast/discussions) on GitHub
- **Architecture feedback**: Review the [Architecture Components](/knowledge-base/03-reference/architecture-components/) page and share your thoughts
- **Use case proposals**: Describe how you'd use this in your organization

### Issues (Open)

- **Bug reports**: [Open an issue](https://github.com/cybersader/openclast/issues/new)
- **Feature requests**: Open an issue with the `enhancement` label

## Future Contributions

When the project opens to contributions, you'll be able to:
- Edit documentation directly on GitHub via "Edit page" links
- Submit pull requests for code and docs
- The knowledge base uses [Obsidian Flavored Markdown](https://help.obsidian.md/Editing+and+formatting/Obsidian+Flavored+Markdown) — wikilinks, callouts, mermaid diagrams all work

## Knowledge Base Structure

The `knowledge-base/` directory uses a temperature gradient system. When adding research or documentation:

| What You're Adding | Where to Put It |
|-------------------|-----------------|
| Quick note or idea | `00-inbox/` |
| Active research or draft | `01-working/` |
| Distilled insight or finding | `02-learnings/` (use SCREAMING_SNAKE_CASE) |
| Stable reference doc | `03-reference/` |

Session logs documenting decisions should be prefixed with the date: `YYYY-MM-DD-topic.md`
