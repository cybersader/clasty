# VNC/Remote Desktop Gateway Options

Comparison of browser-based remote desktop solutions for Layer 1.

---

## Current Status: Evaluating

Need to select between Kasm, Guacamole, or Selkies for production. POC uses docker-compose with linuxserver/obsidian.

---

## Options

### Kasm Workspaces

**Website**: https://kasmweb.com/

**Type**: Enterprise VDI platform

**Pros**:
- Enterprise-ready with SSO integration
- Session management and persistence
- Container-based isolation
- Scaling and load balancing
- Good documentation

**Cons**:
- Licensing cost (enterprise features)
- Requires VM or bare metal (not LXC/WSL)
- More complex to set up

**Best For**: Enterprise deployments with budget for licensing.

**Notes**:
- Can use linuxserver single-container version for POC
- Full version needs dedicated infrastructure
- Supports OIDC, SAML, LDAP

---

### Apache Guacamole

**Website**: https://guacamole.apache.org/

**Type**: Open source clientless remote desktop gateway

**Pros**:
- Completely free and open source
- Simple to deploy
- Supports VNC, RDP, SSH
- Well-documented
- Active community

**Cons**:
- Less enterprise features (session management)
- Manual scaling
- UI less polished than Kasm

**Best For**: POC, small teams, budget-conscious deployments.

**Notes**:
- Uses guacd daemon + web frontend
- Can add SSO with OIDC extension
- Docker images available

---

### Selkies / GStreamer

**Website**: https://github.com/selkies-project/selkies-gstreamer

**Type**: WebRTC-based remote desktop

**Pros**:
- WebRTC = lower latency than VNC
- GPU acceleration support
- Modern architecture

**Cons**:
- Newer, less mature
- More complex setup
- Fewer enterprise features

**Best For**: Performance-critical, low-latency requirements.

**Notes**:
- Used by Google for cloud gaming
- Requires GPU for best performance
- Can be combined with other solutions

---

### noVNC + Custom Orchestration

**Website**: https://novnc.com/

**Type**: HTML5 VNC client

**Pros**:
- Lightweight
- Open source
- Can build custom solution

**Cons**:
- DIY orchestration needed
- No built-in session management
- More development work

**Best For**: Custom implementations, learning.

---

## Comparison Matrix

| Feature | Kasm | Guacamole | Selkies | noVNC |
|---------|------|-----------|---------|-------|
| SSO Integration | Built-in | Extension | Manual | Manual |
| Session Management | Yes | Basic | No | No |
| Scaling | Built-in | Manual | Manual | Manual |
| Latency | Good (VNC) | Good (VNC) | Best (WebRTC) | Good |
| Cost | Licensing | Free | Free | Free |
| Setup Complexity | Medium | Low | High | Medium |
| Documentation | Excellent | Good | Fair | Good |

---

## Recommendation

**For POC**: Apache Guacamole (free, simple, proven)

**For Enterprise**: Kasm Workspaces (SSO, session management, scaling)

**For Low-Latency**: Selkies (WebRTC, but more complex)

---

## Resources

- [Kasm Docs](https://kasmweb.com/docs/)
- [Guacamole Manual](https://guacamole.apache.org/doc/gug/)
- [Selkies GitHub](https://github.com/selkies-project/selkies-gstreamer)
- [linuxserver/obsidian](https://docs.linuxserver.io/images/docker-obsidian/)
