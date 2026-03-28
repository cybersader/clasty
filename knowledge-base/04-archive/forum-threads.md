# Forum Threads & Discussions

Links to relevant Obsidian forum discussions, Reddit threads, and GitHub issues.

---

## Obsidian Forum

### Obsidian for Web (Main Thread)

**URL**: https://forum.obsidian.md/t/obsidian-for-web/2049

**Key Points**:
- Long-running feature request (since 2020)
- Official response: No plans for web version
- Reason: Obsidian depends on local filesystem
- Community workarounds discussed

**Relevant Comments**:
- Discussion of Docker + VNC approaches
- Kasm Workspaces mentioned
- CRDT sync suggestions

---

### Enterprise/Corporate Threads

**URLs**:
- https://forum.obsidian.md/t/obsidian-at-work/18504
- https://forum.obsidian.md/t/trying-obsidian-in-a-corporate-environment/68816
- https://forum.obsidian.md/t/soc-2-iso-27001-certification/50037

**Key Points**:
- Demand for enterprise features
- SSO/SAML requests
- Security certifications discussion
- Plugin security concerns

---

### Collaboration Threads

**URLs**:
- https://forum.obsidian.md/t/obsidian-publish-authentication-for-corporate-use-single-sign-on/19255
- https://help.obsidian.md/Teams/Syncing+for+teams

**Key Points**:
- Official team sync documentation
- Obsidian Sync for teams
- Limitations of current approach

---

## Reddit

### r/ObsidianMD Relevant Posts

**URLs**:
- https://www.reddit.com/r/ObsidianMD/comments/10sj378/web_version_of_obsidian/
- https://www.reddit.com/r/ObsidianMD/comments/s13lp5/has_anyone_here_tried_to_virtualize_obsidian_in/

**Key Points**:
- User frustration with no web version
- Docker virtualization attempts
- Workarounds discussed

---

## GitHub

### Obsidian-Remote

**URL**: https://github.com/sytone/obsidian-remote

**Description**: Run Obsidian in Docker with browser access.

**Key Points**:
- Community Docker solution
- Uses noVNC
- Good reference for container setup

---

### Obsidian LiveSync

**URL**: https://github.com/vrtmrz/obsidian-livesync

**Description**: Self-hosted sync with CouchDB.

**Key Points**:
- NOT true CRDT (uses revision trees)
- Conflicts possible
- Good for understanding sync challenges

---

### Relay Plugin

**URL**: https://github.com/No-Instructions/Relay

**Description**: Yjs-based Obsidian sync.

**Key Points**:
- True CRDT approach
- Solved file-on-disk problem
- Good reference for Yjs integration

---

### linuxserver/obsidian

**URL**: https://github.com/linuxserver/docker-obsidian

**Description**: Official LinuxServer.io Obsidian container.

**Key Points**:
- Well-maintained Docker image
- KasmVNC integration
- Base for our container

---

## Key Takeaways

1. **No official web version coming** - Obsidian team has stated this clearly

2. **VNC/container approach is viable** - Multiple implementations exist

3. **CRDT is the right approach for sync** - Obsidian LiveSync's revision trees cause conflicts

4. **Enterprise demand is high** - Many forum threads requesting SSO, compliance features

5. **Plugin security is a concern** - Enterprises want control over plugins

---

## Related Notes

- [CRDT Options](crdt-options.md)
- [VNC Options](vnc-options.md)
- [Decision Log](../decisions/decision-log.md)
