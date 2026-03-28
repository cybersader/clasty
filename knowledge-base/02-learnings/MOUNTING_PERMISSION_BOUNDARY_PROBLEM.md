
The Core Tension

  The architecture says: one vault = one permission boundary. But there are two things fighting each other:

  1. Obsidian only opens one vault at a time. You can't link between vaults, search across vaults, or see a unified graph. So if you split content
   into many small permission-scoped vaults (engineering-vault, finance-vault, project-x-vault...), the user experience degrades badly — constant
  vault switching, no cross-linking, no unified knowledge graph.

  2. Organizational access patterns aren't hierarchical — they're a graph. An engineer on Project Alpha might need: engineering docs +
  project-alpha docs + company wiki. A marketer on the same project needs: marketing docs + project-alpha docs + company wiki. You can't represent
   that matrix of permissions in a single folder tree with a single mount point.

  So you're stuck:
  - Few big vaults = good UX (linking, search, graph) but too-permissive access
  - Many small vaults = proper RBAC but terrible UX (no cross-linking, vault switching)

  The decision log even acknowledges the consequence: "Vaults must be organized by access level (can't have mixed permissions within a vault)" —
  but doesn't really grapple with how limiting that is in practice.

  A Better Model: Composite Vault via Bind Mounts

  Instead of "mount a vault," the orchestrator could assemble a per-user vault from multiple authorized folders:

  Engineer on Project Alpha sees:
  /user-vault/                     <- Obsidian opens this ONE vault
    .obsidian/                     <- Per-user config
    engineering/                   <- bind mount from shared storage
    project-alpha/                 <- bind mount from shared storage
    wiki/                          <- bind mount from shared storage
    personal/                      <- private space

  Marketer on Project Alpha sees:
  /user-vault/
    .obsidian/
    marketing/                     <- bind mount
    project-alpha/                 <- bind mount (same source!)
    wiki/                          <- bind mount
    personal/

  Each subfolder is an independently-mountable permission boundary. The orchestrator assembles the user's personalized vault at session start. To
  Obsidian, it's one vault — full linking, search, and graph across everything the user can access.

  Cross-links pointing to content the user can't see just become dead links (the file literally isn't mounted). That's a graceful degradation, not
   a security hole.

  What This Doesn't Solve

  You're still constrained by the tree structure problem. If content naturally belongs to both "engineering" and "project-alpha," you have to pick
   one folder or duplicate it. The content organization must be designed around access boundaries rather than conceptual taxonomy. That's a real
  tradeoff — but it's inherent to any filesystem-based permission model.

  Bottom Line

  The current architecture's "vault-level RBAC" is actually too coarse. Folder-level RBAC via composite bind mounts is a more flexible middle
  ground between "whole vault or nothing" and the rejected "file-level permissions" approach. It keeps the simplicity (mount-time enforcement, no
  runtime checks) while being much more granular.

  Want me to explore this composite mount approach further and update the architecture docs? Or are you thinking about this differently?