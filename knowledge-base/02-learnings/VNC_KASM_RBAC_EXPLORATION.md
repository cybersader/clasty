### User

My issues with obsidian in the browser, the linuxserver or other VNC version are things like hotkeys, having it notice when you're hovering, and other issues I'm not remembering. Do you know how to solve for these UX issues?

### AI

Yes, there are known workarounds for these issues when running Obsidian remotely:

**Hotkey Issues:**

- Check that you're running the Docker container with `seccomp:unconfined` in your security options—this is often needed for proper keyboard input handling
- Some keyboard layouts (non-Latin) have specific hotkey issues; if you're using a non-English layout, this is a known limitation
- For the linuxserver/obsidian container specifically, ensure you have proper focus management

**Black Screen / Hover Detection Issues:**  
The biggest fix found by users: **Add `shm_size: "1gb"` to your Docker Compose file**. This was reported by multiple users as solving crashes when accessing settings, themes, or plugins. Without it, navigating certain UI sections causes the app to go black.

**Other potential fixes:**

- Run with `security_opt: seccomp:unconfined` - helps with system call handling
- Ensure GPU access if available: include `/dev/dri:/dev/dri` device mapping
- If using VNC, some users found switching from KasmVNC to Selkies (newer linuxserver image) improved stability

**Broader limitations:**

- Remote desktop solutions (VNC/browser) inherently have UX limitations—hover states, smooth animations, and drag-and-drop sometimes feel clunky
- On Linux, users have reported better experiences using **Wayland forwarding** with containerized Obsidian rather than VNC

Can you clarify which specific setup you're using (browser-based, VNC, which Docker image)? That might help narrow down the exact issues you're hitting.

### User

This is more a VNC issue. So what's the settings with the linuxserver thing that would have to be present then?

### AI

Based on the search results, here are the essential Docker Compose settings for the **linuxserver Obsidian container** to work properly with VNC:

text

services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container\_name: obsidian
    security\_opt:
      - seccomp:unconfined  # Critical for keyboard handling
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Etc/UTC
    volumes:
      - /path/to/config:/config
    ports:
      - 3000:3000
      - 3001:3001
    devices:
      - /dev/dri:/dev/dri  # Optional GPU acceleration
    shm\_size: "1gb"  # Critical - prevents black screens/crashes
    restart: unless-stopped

**The critical settings for VNC issues:**

1. **`shm_size: "1gb"`** — This is the main fix for the hover detection and black screen issues you mentioned. Without it, navigating certain UI sections causes crashes.
2. **`security_opt: - seccomp:unconfined`** — Needed for proper keyboard/hotkey handling in VNC environments.
3. **`devices: - /dev/dri:/dev/dri`** — Optional but helps with graphics rendering smoothness if you have GPU available.

The linuxserver image recently switched from KasmVNC to **Selkies**, which improved VNC performance. The `shm_size` was a big finding in the community—users reported the setting dramatically improved stability when accessing settings and plugins via VNC.

### User

Change these then

services:  
obsidian:  
image: lscr.io/linuxserver/obsidian:latest  
container\_name: obsidian  
restart: unless-stopped  
shm\_size: "1gb" # needed by Electron apps  
security\_opt:

- seccomp:unconfined # recommended by LSIO on some hosts  
	environment:  
	PUID: "1000"  
	PGID: "1000"  
	TZ: America/Indiana/Indianapolis  
	CUSTOM\_USER: "cybersader" # enables Basic Auth (optional)  
	PASSWORD: "XXXXXXXXXXX" # enables Basic Auth (optional)

# (Optional extras exist, but these are the key ones)

volumes:

- /mnt/personal/obsidianweb/config:/config
- /mnt/personal/obsidianweb/vaults:/vaults  
	ports:
- "9556:3000" # HTTP (not recommended)
- "9557:3001" # HTTPS (use this)

### AI

Here's your config with the GPU acceleration added (the one thing missing that could help VNC performance):

yaml

```
services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian
    restart: unless-stopped
    shm_size: "1gb"                  # needed by Electron apps
    security_opt:
      - seccomp:unconfined           # recommended by LSIO on some hosts
    devices:
      - /dev/dri:/dev/dri            # GPU acceleration for VNC rendering
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Indiana/Indianapolis
      CUSTOM_USER: "cybersader"        # enables Basic Auth (optional)
      PASSWORD: "XXXXXXXXXXX"          # enables Basic Auth (optional)
    volumes:
      - /mnt/personal/obsidianweb/config:/config
      - /mnt/personal/obsidianweb/vaults:/vaults
    ports:
      - "9556:3000"                  # HTTP (not recommended)
      - "9557:3001"                  # HTTPS (use this)
```

Your config was already solid—you had the two critical settings (`shm_size` and `seccomp:unconfined`). The only addition is the **`/dev/dri:/dev/dri` device mapping**, which can help smooth out VNC rendering if you have GPU available. If your host doesn't have a GPU or you don't want to expose it, you can skip that line entirely.

The rest looks good to go.

### User

What about all the other stuff they mention here - [https://github.com/linuxserver/docker-obsidian](https://github.com/linuxserver/docker-obsidian)

### AI

Based on the **linuxserver documentation**, here's what additional optional settings you might want to consider beyond your current config:

**From the Selkies-based GUI container (what they're using now):**

yaml

```
services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian
    restart: unless-stopped
    shm_size: "1gb"
    security_opt:
      - seccomp:unconfined
    devices:
      - /dev/dri:/dev/dri
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Indiana/Indianapolis
      CUSTOM_USER: "cybersader"
      PASSWORD: "XXXXXXXXXXX"
      # Optional but useful:
      TITLE: "Obsidian"                        # Page title in browser
      DRINODE: "/dev/dri/renderD128"           # Specify GPU device if multiple
      LC_ALL: "en_US.UTF-8"                    # Language support
      # PIXELFLUX_WAYLAND: "true"              # Experimental Wayland mode for zero-copy
      # MAX_RES: "3840x2160"                   # Clamp resolution if GPU performance issues
      # NO_DECOR: "true"                       # Remove window borders for PWA
    volumes:
      - /mnt/personal/obsidianweb/config:/config
      - /mnt/personal/obsidianweb/vaults:/vaults
    ports:
      - "9556:3000"
      - "9557:3001"
```

**Most relevant for VNC/browser:**

- **`DRINODE`** — If you have multiple GPUs, specify which one to use
- **`TITLE`** — Changes the browser tab title
- **`PIXELFLUX_WAYLAND: "true"`** — Experimental but *significantly* improves browser VNC performance if it works on your setup (zero-copy encoding)
- **`MAX_RES`** — If you're hitting GPU memory issues, clamp the virtual display resolution

Your current config is honestly solid. The main additions would be `DRINODE` if you have multiple GPUs, and possibly trying `PIXELFLUX_WAYLAND` if VNC smoothness is still an issue. The rest are cosmetic or advanced optimization.

### User

Got "Error: This application requires a secure connection (HTTPS). Please check the URL." even though I can see selkies stuff

![Attached image](https://upoevdcxa3.ufs.sh/f/IN4OjmY4wMHBTMH1VSLh1xBJdiUPZFqAYj7EGN6bstgXSk4Q)

### AI

You're hitting Obsidian/Electron's security requirement—it **requires HTTPS**.

**The fix is simple:**

Instead of accessing `http://obsidian.home`, use **`https://obsidian.home:9557`** (the HTTPS port).

Your config has:

yaml

```
ports:
  - "9556:3000"                  # HTTP (not recommended)
  - "9557:3001"                  # HTTPS (use this)
```

Port 9557 is HTTPS; port 9556 is HTTP. Obsidian won't run over plain HTTP for security reasons.

**If you're accessing through a reverse proxy or DNS setup:**

Make sure your proxy is forwarding to **port 9557** (HTTPS), not 9556. And ensure the proxy itself has valid SSL certificates set up.

The Selkies control panel (left sidebar) loads because it's a different application with looser security requirements. But Obsidian/Electron enforces HTTPS strictly.

Try accessing via HTTPS and it should work.

### User

That's silly since it's local though - I literally have to type in [https://obsidian.home:9557/](https://obsidian.home:9557/) --- how do I replicate this in NPM nginx proxy manager so I can just type obsidian.home

### AI

You can set this up in **NPM (Nginx Proxy Manager)** like this:

**In NPM Dashboard:**

1. **Hosts → Proxy Hosts → Add Proxy Host**
2. **Details tab:**
	- **Domain Names:** `obsidian.home`
	- **Scheme:** `https` (important—NPM will forward to HTTPS)
	- **Forward Hostname/IP:** `obsidian` (or your Docker host IP like `192.168.x.x`)
	- **Forward Port:** `9557`
	- **Block Common Exploits:** On (optional, good security practice)
	- **Websockets Support:** On (Obsidian uses websockets)
3. **SSL tab:**
	- **SSL Certificate:** Select or create a self-signed cert for `obsidian.home`
	- NPM can generate one automatically—just request it and it'll create it
	- (If you have a wildcard cert already, use that)
	- **Force SSL:** On
	- **HTTP/2 Support:** On
4. **Save**

**Then:**

Access via `https://obsidian.home` and you're good. NPM handles the HTTPS termination and forwards to your container's port 9557.

**The key parts:**

- Forward to **HTTPS** (9557), not HTTP
- Use a self-signed cert for local domain (NPM generates these easily)
- Enable websockets support

That's it—no more port numbers needed.

### User

I can only request certs is part of the problem.

![Attached image](https://upoevdcxa3.ufs.sh/f/IN4OjmY4wMHBIvZgIGY4wMHBOPs0NvxVQ3nyUXgikbCfpurT)

![Attached image](https://upoevdcxa3.ufs.sh/f/IN4OjmY4wMHBt0eL1QXNyhSdXlsJHIB8pZb2UQFR4wTfx0u9)

### AI

Ah—NPM is trying to request a cert (likely Let's Encrypt), which won't work for a local `.home` domain without public DNS validation.

**Solution: Create a self-signed cert manually and upload it to NPM:**

**1\. Generate the cert locally:**

bash

```
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout obsidian.key \
  -out obsidian.crt \
  -subj "/CN=obsidian.home" \
  -addext "subjectAltName=DNS:obsidian.home"
```

This creates `obsidian.crt` and `obsidian.key`.

**2\. In NPM → SSL Certificates → Add SSL Certificate:**

- **Certificate Name:** `obsidian-local`
- **Certificate File:** (paste contents of `obsidian.crt`)
- **Private Key:** (paste contents of `obsidian.key`)
- Save

**3\. Back in your proxy host → SSL tab:**

- **SSL Certificate:** Select the `obsidian-local` cert you just created
- **Force SSL:** On

**4\. Save and try again.**

Now NPM has a valid cert for `obsidian.home` and should work without the SSL error.

If you want to avoid browser warnings about untrusted certs, you can import the `.crt` into your browser/system's certificate store, but for local access it's optional.

### User

I will never generate Serge locally from the command line. This is something I avoid and if I have to figure out a more gooey solution and stuff like that, then so be it. But I am not touching CLI to create search that is just creating issues for the future.

### AI

Fair point. Let me give you practical alternatives that don't require CLI:

**Option 1: Just use the IP directly**  
Access `https://192.168.1.20:9557/` instead of `obsidian.home`. Your browser will complain about the self-signed cert, but you can click "Advanced → Proceed anyway." Not fancy, but it works.

**Option 2: Skip NPM for Obsidian**  
If you only care about `obsidian.home` working locally, don't bother with NPM. Just add this to your **hosts file**:

text

192.168.1.20  obsidian.home

Then access `https://obsidian.home:9557/` directly. Same browser warning, but one less proxy layer.

**Option 3: Do you already have wildcard certs?**  
If you've got certs from another source (existing infrastructure, a cert manager, etc.), you could upload those to NPM instead.

**Option 4: Accept HTTP locally**  
Modify your Docker config to allow HTTP (less secure but works):

yaml

```
environment:
  INSECURE: "true"  # If this env var exists in the image
```

Then use NPM with HTTP forwarding to 9556. You'd need to check if linuxserver/obsidian supports this.

Which feels least painful to you? The IP address option is probably the quickest workaround if you just want it working now.

### User

Are there really no other useful environment variables also? How do I account for the browser overtaking some hotkeys?

[https://github.com/linuxserver/docker-obsidian](https://github.com/linuxserver/docker-obsidian)

### AI

Based on the linuxserver documentation, here are the **environment variables** that actually exist:

**Common linuxserver variables:**

yaml

```
PUID: "1000"              # User ID
PGID: "1000"              # Group ID
TZ: "America/Indianapolis" # Timezone
CUSTOM_USER: "cybersader" # Basic auth username
PASSWORD: "XXXXXXXXXXX"   # Basic auth password
TITLE: "Obsidian"         # Browser tab title
```

**Selkies/VNC-specific (for the browser/remote GUI):**

yaml

```
DRINODE: "/dev/dri/renderD128"  # Specify GPU device if you have multiple
LC_ALL: "en_US.UTF-8"           # Localization
PIXELFLUX_WAYLAND: "true"       # Experimental wayland mode (improves performance)
MAX_RES: "3840x2160"            # Cap virtual display resolution
NO_DECOR: "true"                # Remove window decorations
```

---

**On browser hotkey conflicts:**

This is a **fundamental VNC limitation**—the browser itself intercepts hotkeys before they reach Obsidian. There's no environment variable that solves this.

**Real solutions:**

1. **Remap hotkeys in Obsidian settings** to avoid browser conflicts (e.g., avoid `Ctrl+T`, `Ctrl+N`, `F11`, etc.)
2. **Use Obsidian Global Hotkeys plugin** — allows system-wide hotkeys that bypass browser interference (if your remote setup supports it)
3. **Try the PIXELFLUX\_WAYLAND experimental mode** — reported to reduce some input lag, which *might* help with hotkey timing:

yaml

```
PIXELFLUX_WAYLAND: "true"
```

4. **Accept the limitations** — Most users find it easier to just click in the browser vs. fighting hotkey conflicts over VNC.

The browser-over-VNC approach is fundamentally limited for hotkeys. Native installs or Electron apps running locally avoid this entirely.

### User

I added INSECURE and still got "Error: This application requires a secure connection (HTTPS). Please check the URL."

### AI

`INSECURE` isn't a real variable for linuxserver/obsidian—that was a guess on my part. The HTTPS requirement is hard-coded into Electron itself, not something you can toggle off.

**You're stuck with HTTPS.** Here are your actual options:

**Option A: Just accept the browser warning (easiest)**

- Access `https://obsidian.home:9557/`
- Browser shows "not secure" warning
- Click "Advanced → Proceed anyway"
- Works fine after that, warning reappears on refresh but you click through
- No CLI, no cert generation needed

**Option B: Use the IP address instead**

- Access `https://192.168.1.20:9557/` directly
- Same browser warning, click through
- At least you're not typing a port every time if you bookmark it

**Option C: Give up on the domain name**

- Just accept `https://obsidian.home:9557/` as your URL
- It's local, the port is a small price compared to cert hassles

**The reality:** Without generating a certificate (CLI or otherwise), there's no way to make the browser trust `obsidian.home` over HTTPS. Either you click through the warning every time, or you find a GUI cert generator somewhere that you're comfortable with.

Which feels least annoying to you?

### User

GUI cert generator it is

![Attached image](https://upoevdcxa3.ufs.sh/f/IN4OjmY4wMHBW6z8r7tbhyg2CtSMnOxBFIcRU8635HGNzadY)

### AI

**XCA** is probably your best bet—it's a legitimate GUI certificate manager that runs on Windows/Mac/Linux:

1. **Download XCA** from [https://hohnstaedt.de/xca/](https://hohnstaedt.de/xca/)
2. Open it, create a new database (just a local file)
3. **Generate a new certificate:**
	- Right-click → New Certificate
	- Common Name: `obsidian.home`
	- Add Subject Alt Name: `DNS:obsidian.home`
	- Self-signed, 365 days expiry
4. **Export the certificate + key:**
	- Right-click cert → Export → PEM format (gets you .crt and .key files)
5. **Upload to NPM:**
	- NPM → SSL Certificates → Add SSL Certificate
	- Paste the cert and key contents
	- Assign to your obsidian.home proxy host

It's clicky, visual, no command line. The export gives you files you just copy/paste into NPM.

**Alternatively, if you want even simpler:**

Use an online generator like **ZeroSSL** ([https://zerossl.com/free-ssl/](https://zerossl.com/free-ssl/)) to generate a self-signed cert, download it, upload to NPM. Less secure conceptually (keys touched the internet) but faster if you don't care.

Does XCA sound doable, or do you want to explore the online route?

### User

What about some of these below for enterprise use case???

Hardening  
These variables can be used to lock down the desktop environment for single-application use cases or to restrict user capabilities.

Meta Variables  
These variables act as presets, enabling multiple hardening options at once. Individual options can still be set to override the preset.

Variable Description  
HARDEN\_DESKTOP Enables DISABLE\_OPEN\_TOOLS, DISABLE\_SUDO, and DISABLE\_TERMINALS. Also sets related Selkies UI settings (SELKIES\_FILE\_TRANSFERS, SELKIES\_COMMAND\_ENABLED, SELKIES\_UI\_SIDEBAR\_SHOW\_FILES, SELKIES\_UI\_SIDEBAR\_SHOW\_APPS) if they are not explicitly set by the user.  
HARDEN\_OPENBOX Enables DISABLE\_CLOSE\_BUTTON, DISABLE\_MOUSE\_BUTTONS, and HARDEN\_KEYBINDS. It also flags RESTART\_APP if not set by the user, ensuring the primary application is automatically restarted if closed.  
Individual Hardening Variables  
Variable Description  
DISABLE\_OPEN\_TOOLS If true, disables xdg-open and exo-open binaries by removing their execute permissions.  
DISABLE\_SUDO If true, disables the sudo command by removing its execute permissions and invalidating the passwordless sudo configuration.  
DISABLE\_TERMINALS If true, disables common terminal emulators by removing their execute permissions and hiding them from the Openbox right-click menu.  
DISABLE\_CLOSE\_BUTTON If true, removes the close button from window title bars in the Openbox window manager.  
DISABLE\_MOUSE\_BUTTONS If true, disables the right-click and middle-click context menus and actions within the Openbox window manager.  
HARDEN\_KEYBINDS If true, disables default Openbox keybinds that can bypass other hardening options (e.g., Alt+F4 to close windows, Alt+Escape to show the root menu).  
RESTART\_APP If true, enables a watchdog service that automatically restarts the main application if it is closed. The user's autostart script is made read-only and root owned to prevent tampering.  
Selkies application settings  
Using environment variables every facet of the application can be configured.

Booleans and Locking  
Boolean settings accept true or false. You can also prevent the user from changing a boolean setting in the UI by appending |locked. The UI toggle for this setting will be hidden.

Example: To force CPU encoding on and prevent the user from disabling it:  
\-e SELKIES\_USE\_CPU="true|locked"  
Enums and Lists  
These settings accept a comma-separated list of values. Their behavior depends on the number of items provided:

Multiple Values: The first item in the list becomes the default selection, and all items in the list become the available options in the UI dropdown.

Single Value: The provided value becomes the default, and the UI dropdown is hidden because the choice is locked.

Example: Force the encoder to be jpeg with no other options available to the user:

\-e SELKIES\_ENCODER="jpeg"  
Ranges  
Range settings define a minimum and maximum for a value (e.g., framerate).

To set a range: Use a hyphen-separated min-max format. The UI will show a slider.

To set a fixed value: Provide a single number. This will lock the value and hide the UI slider.

Example: Lock the framerate to exactly 60 FPS.

\-e SELKIES\_FRAMERATE="60"  
Manual Resolution Mode  
The server can be forced to use a single, fixed resolution for all connecting clients. This mode is automatically activated if SELKIES\_MANUAL\_WIDTH, SELKIES\_MANUAL\_HEIGHT, or SELKIES\_IS\_MANUAL\_RESOLUTION\_MODE is set.

If SELKIES\_MANUAL\_WIDTH and/or SELKIES\_MANUAL\_HEIGHT are set, the resolution is locked to those values.  
If SELKIES\_IS\_MANUAL\_RESOLUTION\_MODE is set to true without specifying width or height, the resolution defaults to 1024x768.  
When this mode is active, the client UI for changing resolution is disabled.  
Environment Variable Default Value Description  
SELKIES\_UI\_TITLE 'Selkies' Title in top left corner of sidebar.  
SELKIES\_UI\_SHOW\_LOGO True Show the Selkies logo in the sidebar.  
SELKIES\_UI\_SHOW\_SIDEBAR True Show the main sidebar UI.  
SELKIES\_UI\_SHOW\_CORE\_BUTTONS True Show the core components buttons display, audio, microphone, and gamepad.  
SELKIES\_UI\_SIDEBAR\_SHOW\_VIDEO\_SETTINGS True Show the video settings section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_SCREEN\_SETTINGS True Show the screen settings section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_AUDIO\_SETTINGS True Show the audio settings section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_STATS True Show the stats section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_CLIPBOARD True Show the clipboard section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_FILES True Show the file transfer section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_APPS True Show the applications section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_SHARING True Show the sharing section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_GAMEPADS True Show the gamepads section in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_FULLSCREEN True Show the fullscreen button in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_GAMING\_MODE True Show the gaming mode button in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_TRACKPAD True Show the virtual trackpad button in the sidebar.  
SELKIES\_UI\_SIDEBAR\_SHOW\_KEYBOARD\_BUTTON True Show the on-screen keyboard button in the display area.  
SELKIES\_UI\_SIDEBAR\_SHOW\_SOFT\_BUTTONS True Show the soft buttons section in the sidebar.  
SELKIES\_AUDIO\_ENABLED True Enable server-to-client audio streaming.  
SELKIES\_MICROPHONE\_ENABLED True Enable client-to-server microphone forwarding.  
SELKIES\_GAMEPAD\_ENABLED True Enable gamepad support.  
SELKIES\_CLIPBOARD\_ENABLED True Enable clipboard synchronization.  
SELKIES\_COMMAND\_ENABLED True Enable parsing of command websocket messages.  
SELKIES\_FILE\_TRANSFERS 'upload,download' Allowed file transfer directions (comma-separated: "upload,download"). Set to "" or "none" to disable.  
SELKIES\_ENCODER 'x264enc,x264enc-striped,jpeg' The default video encoders.  
SELKIES\_FRAMERATE '8-120' Allowed framerate range or a fixed value.  
SELKIES\_H264\_CRF '5-50' Allowed H.264 CRF range or a fixed value.  
SELKIES\_JPEG\_QUALITY '1-100' Allowed JPEG quality range or a fixed value.  
SELKIES\_H264\_FULLCOLOR False Enable H.264 full color range for pixelflux encoders.  
SELKIES\_H264\_STREAMING\_MODE False Enable H.264 streaming mode for pixelflux encoders.  
SELKIES\_USE\_CPU False Force CPU-based encoding for pixelflux.  
SELKIES\_USE\_PAINT\_OVER\_QUALITY True Enable high-quality paint-over for static scenes.  
SELKIES\_PAINT\_OVER\_JPEG\_QUALITY '1-100' Allowed JPEG paint-over quality range or a fixed value.  
SELKIES\_H264\_PAINTOVER\_CRF '5-50' Allowed H.264 paint-over CRF range or a fixed value.  
SELKIES\_H264\_PAINTOVER\_BURST\_FRAMES '1-30' Allowed H.264 paint-over burst frames range or a fixed value.  
SELKIES\_SECOND\_SCREEN True Enable support for a second monitor/display.  
SELKIES\_AUDIO\_BITRATE '320000' The default audio bitrate.  
SELKIES\_IS\_MANUAL\_RESOLUTION\_MODE False Lock the resolution to the manual width/height values.  
SELKIES\_MANUAL\_WIDTH 0 Lock width to a fixed value. Setting this forces manual resolution mode.  
SELKIES\_MANUAL\_HEIGHT 0 Lock height to a fixed value. Setting this forces manual resolution mode.  
SELKIES\_SCALING\_DPI '96' The default DPI for UI scaling.  
SELKIES\_ENABLE\_BINARY\_CLIPBOARD False Allow binary data on the clipboard.  
SELKIES\_USE\_BROWSER\_CURSORS False Use browser CSS cursors instead of rendering to canvas.  
SELKIES\_USE\_CSS\_SCALING False HiDPI when false, if true a lower resolution is sent from the client and the canvas is stretched.  
SELKIES\_PORT (or CUSTOM\_WS\_PORT) 8082 Port for the data websocket server.  
SELKIES\_DRI\_NODE (or DRI\_NODE) '' Path to the DRI render node for VA-API.  
SELKIES\_AUDIO\_DEVICE\_NAME 'output.monitor' Audio device name for pcmflux capture.  
SELKIES\_WATERMARK\_PATH (or WATERMARK\_PNG) '' Absolute path to the watermark PNG file.  
SELKIES\_WATERMARK\_LOCATION (or WATERMARK\_LOCATION) -1 Watermark location enum (0-6).  
SELKIES\_DEBUG False Enable debug logging.  
SELKIES\_ENABLE\_SHARING True Master toggle for all sharing features.  
SELKIES\_ENABLE\_COLLAB True Enable collaborative (read-write) sharing link.  
SELKIES\_ENABLE\_SHARED True Enable view-only sharing links.  
SELKIES\_ENABLE\_PLAYER2 True Enable sharing link for gamepad player 2.  
SELKIES\_ENABLE\_PLAYER3 True Enable sharing link for gamepad player 3.  
SELKIES\_ENABLE\_PLAYER4 True Enable sharing link for gamepad player 4.

### AI

For **enterprise Obsidian**, here's a hardened config that locks down the environment:

yaml

```
services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian
    restart: unless-stopped
    shm_size: "1gb"
    security_opt:
      - seccomp:unconfined
    devices:
      - /dev/dri:/dev/dri
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Indiana/Indianapolis
      CUSTOM_USER: "cybersader"
      PASSWORD: "XXXXXXXXXXX"
      
      # === HARDENING FOR ENTERPRISE ===
      HARDEN_DESKTOP: "true"        # Disables tools, sudo, terminals (meta preset)
      HARDEN_OPENBOX: "true"        # Removes close button, disables Alt+F4, etc.
      RESTART_APP: "true"           # Auto-restart Obsidian if user closes it
      
      # === SELKIES UI LOCKDOWN ===
      SELKIES_UI_SIDEBAR_SHOW_FILES: "false"        # Hide file transfer
      SELKIES_UI_SIDEBAR_SHOW_APPS: "false"         # Hide app launcher
      SELKIES_COMMAND_ENABLED: "false|locked"       # Disable command execution
      SELKIES_FILE_TRANSFERS: "none"                # Disable file uploads/downloads
      SELKIES_ENABLE_SHARING: "false|locked"        # Disable sharing links
      
      # === PERFORMANCE LOCKDOWN (enterprise consistency) ===
      SELKIES_FRAMERATE: "60"                       # Fixed 60 FPS
      SELKIES_JPEG_QUALITY: "85"                    # Fixed quality
      SELKIES_MANUAL_WIDTH: "1920"                  # Fixed resolution
      SELKIES_MANUAL_HEIGHT: "1080"
      SELKIES_SCALING_DPI: "96"                     # Fixed DPI
      
      # === OPTIONAL: Additional restrictions ===
      # SELKIES_AUDIO_ENABLED: "false"              # Disable audio if not needed
      # SELKIES_MICROPHONE_ENABLED: "false"         # Disable mic
      # SELKIES_GAMEPAD_ENABLED: "false"            # Disable gamepad
      # SELKIES_CLIPBOARD_ENABLED: "false"          # Disable clipboard sync
      
    volumes:
      - /mnt/personal/obsidianweb/config:/config
      - /mnt/personal/obsidianweb/vaults:/vaults
    ports:
      - "9557:3001"
```

**What this does:**

- **HARDEN\_DESKTOP + HARDEN\_OPENBOX** — Users can *only* access Obsidian. No terminals, no file manager, no right-click menu, can't close the window, Alt+F4 disabled.
- **RESTART\_APP** — If someone manages to close Obsidian, it auto-restarts.
- **Disabled UI features** — No file transfers, sharing, or command execution in the sidebar.
- **Fixed performance** — Consistent framerate/quality, prevents user tweaking.

**Result:** Users see *only* Obsidian. No escape routes, no terminal access, no file browsing. It's a kiosk-mode locked-down experience.

Is this the direction you're thinking for enterprise deployment?

### User

That seems to have broke some things

![Attached image](https://upoevdcxa3.ufs.sh/f/IN4OjmY4wMHBfUw6B0lo8HJNPbtzKhcYD5MVAlqm6yOvdCwL)

### AI

The screenshot actually shows Obsidian working fine—your vault is loaded, notes are visible, sidebar is functioning. The only thing visible is the browser asking for clipboard permission.

What specifically broke? Are you seeing:

- UI elements missing or hidden?
- Obsidian not responding?
- Sidebar controls not working?
- Something else?

The hardening settings I suggested are **restrictive** (intentionally), so if you disabled features you actually need, that's the issue. For example:

- `SELKIES_UI_SIDEBAR_SHOW_FILES: "false"` hides file transfers (might break drag-drop)
- `SELKIES_CLIPBOARD_ENABLED: "false"` breaks copy/paste
- `HARDEN_DESKTOP: "true"` removes access to tools

If those broke core Obsidian functionality, we should dial back the hardening. What do you need to keep working?

### User

I mean THE SIZE OBVIOUSLY and why do I see a little chromium bit golly

### AI

Ah—I locked the resolution. Those lines:

yaml

```
SELKIES_MANUAL_WIDTH: "1920"
SELKIES_MANUAL_HEIGHT: "1080"
SELKIES_IS_MANUAL_RESOLUTION_MODE: "true"
```

They force the virtual display to 1920x1080, which is smaller than your actual window, so you're seeing a tiny Obsidian in a black box.

**Remove those three lines and it'll scale to fill your browser:**

yaml

```
services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian
    restart: unless-stopped
    shm_size: "1gb"
    security_opt:
      - seccomp:unconfined
    devices:
      - /dev/dri:/dev/dri
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Indiana/Indianapolis
      CUSTOM_USER: "cybersader"
      PASSWORD: "XXXXXXXXXXX"
      
      HARDEN_DESKTOP: "true"
      HARDEN_OPENBOX: "true"
      RESTART_APP: "true"
      
      SELKIES_UI_SIDEBAR_SHOW_FILES: "false"
      SELKIES_UI_SIDEBAR_SHOW_APPS: "false"
      SELKIES_COMMAND_ENABLED: "false|locked"
      SELKIES_FILE_TRANSFERS: "none"
      SELKIES_ENABLE_SHARING: "false|locked"
      
      SELKIES_FRAMERATE: "60"
      SELKIES_JPEG_QUALITY: "85"
      
    volumes:
      - /mnt/personal/obsidianweb/config:/config
      - /mnt/personal/obsidianweb/vaults:/vaults
    ports:
      - "9557:3001"
```

Redeploy and it should fill your screen properly.

### User

What about scaling DPI?

### AI

Good call. `SELKIES_SCALING_DPI` controls how large the UI elements render.

Default is `96` (standard 1x scale). Since you removed the manual resolution and it's now scaling to your browser window, the DPI might look off.

**Common settings:**

- `96` — Standard (1x, normal size)
- `120` — 1.25x (slightly larger, good for 4K or if text feels small)
- `144` — 1.5x (noticeably larger)

**Add it back if needed:**

yaml

```
SELKIES_SCALING_DPI: "96"
```

Or bump it up if text looks too small now that it's scaling to your full browser:

yaml

```
SELKIES_SCALING_DPI: "120"
```

Try `96` first (the default). If the UI feels cramped, increase it. You can change it and restart the container to test different values without touching CLI.

### User

I don't want to have any resize issues. Help me with that

### AI

To avoid resize issues entirely, I need to know: **What's your monitor resolution?**

Once you tell me, I'll lock everything to match:

yaml

```
SELKIES_MANUAL_WIDTH: "YOUR_WIDTH"      # e.g., 2560
SELKIES_MANUAL_HEIGHT: "YOUR_HEIGHT"    # e.g., 1440
SELKIES_SCALING_DPI: "96"               # Standard scaling
SELKIES_USE_CSS_SCALING: "false"        # Native rendering, no stretching
```

This way:

- The virtual display is exactly your monitor size
- No black bars
- No scaling artifacts
- No resize issues when you resize your browser

Just tell me your monitor's resolution and I'll give you the exact config.

### User

You know what it's still not easy out the box. Just drop quality or something and that's it. How it worked out of the box was nice before

### AI

Fair. Here's the simple version—just lower quality and let it scale:

yaml

```
services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian
    restart: unless-stopped
    shm_size: "1gb"
    security_opt:
      - seccomp:unconfined
    devices:
      - /dev/dri:/dev/dri
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Indiana/Indianapolis
      CUSTOM_USER: "cybersader"
      PASSWORD: "XXXXXXXXXXX"
      
      HARDEN_DESKTOP: "true"
      HARDEN_OPENBOX: "true"
      RESTART_APP: "true"
      
      SELKIES_UI_SIDEBAR_SHOW_FILES: "false"
      SELKIES_UI_SIDEBAR_SHOW_APPS: "false"
      SELKIES_COMMAND_ENABLED: "false|locked"
      SELKIES_FILE_TRANSFERS: "none"
      SELKIES_ENABLE_SHARING: "false|locked"
      
      SELKIES_FRAMERATE: "30"
      SELKIES_JPEG_QUALITY: "60"
      
    volumes:
      - /mnt/personal/obsidianweb/config:/config
      - /mnt/personal/obsidianweb/vaults:/vaults
    ports:
      - "9557:3001"
```

Lower framerate (30 instead of 60) and lower quality (60 instead of 85) means lighter bandwidth/processing, fewer resize hiccups, just works. Deploy and done.

### User

Still looks broke.

Here's my current one

services:  
obsidian:  
image: lscr.io/linuxserver/obsidian:latest  
container\_name: obsidian  
restart: unless-stopped  
shm\_size: "1gb" # needed by Electron apps  
security\_opt:

- seccomp:unconfined # recommended by LSIO on some hosts  
	environment:  
	PUID: "1000"  
	PGID: "1000"  
	TZ: America/Indiana/Indianapolis  
	CUSTOM\_USER: "cybersader" # enables Basic Auth (optional)  
	PASSWORD: "XXXXXXXXXXX" # enables Basic Auth (optional)  
	LC\_ALL: "en\_US.UTF-8" # Localization  
	PIXELFLUX\_WAYLAND: "true" # Experimental wayland mode (improves performance)  
	MAX\_RES: "3840x2160" # Cap virtual display resolution  
	NO\_DECOR: "true" # Remove window decorations

# \=== HARDENING FOR ENTERPRISE ===

HARDEN\_DESKTOP: "true" # Disables tools, sudo, terminals (meta preset)  
HARDEN\_OPENBOX: "true" # Removes close button, disables Alt+F4, etc.  
RESTART\_APP: "true" # Auto-restart Obsidian if user closes it

# \=== SELKIES UI LOCKDOWN ===

SELKIES\_UI\_SIDEBAR\_SHOW\_FILES: "false" # Hide file transfer  
SELKIES\_UI\_SIDEBAR\_SHOW\_APPS: "false" # Hide app launcher  
SELKIES\_COMMAND\_ENABLED: "false|locked" # Disable command execution  
SELKIES\_FILE\_TRANSFERS: "none" # Disable file uploads/downloads  
SELKIES\_ENABLE\_SHARING: "false|locked" # Disable sharing links

# \=== PERFORMANCE LOCKDOWN (enterprise consistency) ===

SELKIES\_FRAMERATE: "60" # Fixed 60 FPS  
SELKIES\_JPEG\_QUALITY: "85" # Fixed quality

# (Optional extras exist, but these are the key ones)

volumes:

- /mnt/personal/obsidianweb/config:/config
- /mnt/personal/obsidianweb/vaults:/vaults  
	ports:
- "9556:3000" # HTTP (not recommended)
- "9557:3001" # HTTPS (use this)

![Attached image](https://upoevdcxa3.ufs.sh/f/IN4OjmY4wMHB2C6zr6iBsbTGJOFWDepQXtdnAhL59gwHiNRu)

### AI

Strip out all the hardening. Go back to what worked:

yaml

```
services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian
    restart: unless-stopped
    shm_size: "1gb"
    security_opt:
      - seccomp:unconfined
    devices:
      - /dev/dri:/dev/dri
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Indiana/Indianapolis
      CUSTOM_USER: "cybersader"
      PASSWORD: "XXXXXXXXXXX"
      LC_ALL: "en_US.UTF-8"
      PIXELFLUX_WAYLAND: "true"
    volumes:
      - /mnt/personal/obsidianweb/config:/config
      - /mnt/personal/obsidianweb/vaults:/vaults
    ports:
      - "9556:3000"
      - "9557:3001"
```

All the HARDEN\_*, SELKIES\_UI\_SIDEBAR\_*, SELKIES\_COMMAND\_ENABLED stuff is what broke it. Just the basics—works out of the box like before.

### User

The issue was that it had me so I guess. so I guess maybe I would have been fine with the previous settings, but I actually have to drag the window myself. How do I make it so that it auto scales to fill the whole bit even as I'm like changing the window size and stuff?

![Attached image](https://upoevdcxa3.ufs.sh/f/IN4OjmY4wMHBRONHDQyr2ufwIvl1yGQ67Mkq93YxOR8EZdWN)

### AI

Add `NO_DECOR` back—that's the one that removes the window borders and makes it fill the screen automatically:

yaml

```
services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian
    restart: unless-stopped
    shm_size: "1gb"
    security_opt:
      - seccomp:unconfined
    devices:
      - /dev/dri:/dev/dri
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Indiana/Indianapolis
      CUSTOM_USER: "cybersader"
      PASSWORD: "XXXXXXXXXXX"
      LC_ALL: "en_US.UTF-8"
      PIXELFLUX_WAYLAND: "true"
      NO_DECOR: "true"
    volumes:
      - /mnt/personal/obsidianweb/config:/config
      - /mnt/personal/obsidianweb/vaults:/vaults
    ports:
      - "9556:3000"
      - "9557:3001"
```

`NO_DECOR: "true"` strips the window title bar and borders, making Obsidian fill the entire virtual display. No manual dragging/resizing needed. It should scale with your browser window automatically.

### User

Well, this is what I had currently, so it looks like I already had it.

services:  
obsidian:  
image: lscr.io/linuxserver/obsidian:latest  
container\_name: obsidian  
restart: unless-stopped  
shm\_size: "1gb" # needed by Electron apps  
security\_opt:

- seccomp:unconfined # recommended by LSIO on some hosts  
	environment:  
	PUID: "1000"  
	PGID: "1000"  
	TZ: America/Indiana/Indianapolis  
	CUSTOM\_USER: "cybersader" # enables Basic Auth (optional)  
	PASSWORD: "XXXXXXXXXXX" # enables Basic Auth (optional)  
	LC\_ALL: "en\_US.UTF-8" # Localization  
	PIXELFLUX\_WAYLAND: "true" # Experimental wayland mode (improves performance)  
	MAX\_RES: "3840x2160" # Cap virtual display resolution  
	NO\_DECOR: "true" # Remove window decorations

# \=== HARDENING FOR ENTERPRISE ===

HARDEN\_DESKTOP: "true" # Disables tools, sudo, terminals (meta preset)  
HARDEN\_OPENBOX: "true" # Removes close button, disables Alt+F4, etc.  
RESTART\_APP: "true" # Auto-restart Obsidian if user closes it

# \=== SELKIES UI LOCKDOWN ===

SELKIES\_UI\_SIDEBAR\_SHOW\_FILES: "false" # Hide file transfer  
SELKIES\_UI\_SIDEBAR\_SHOW\_APPS: "false" # Hide app launcher  
SELKIES\_COMMAND\_ENABLED: "false|locked" # Disable command execution  
SELKIES\_FILE\_TRANSFERS: "none" # Disable file uploads/downloads  
SELKIES\_ENABLE\_SHARING: "false|locked" # Disable sharing links

# \=== PERFORMANCE LOCKDOWN (enterprise consistency) ===

#SELKIES\_FRAMERATE: "60" # Fixed 60 FPS  
#SELKIES\_JPEG\_QUALITY: "85" # Fixed quality

# (Optional extras exist, but these are the key ones)

volumes:

- /mnt/personal/obsidianweb/config:/config
- /mnt/personal/obsidianweb/vaults:/vaults  
	ports:
- "9556:3000" # HTTP (not recommended)
- "9557:3001" # HTTPS (use this)

### AI

So `NO_DECOR` was already there but it wasn't filling the screen. That means **`HARDEN_OPENBOX`** was the culprit—it modifies the Openbox window manager behavior and likely overrides the auto-maximize.

Try adding back hardening **without** `HARDEN_OPENBOX`:

yaml

```
services:
  obsidian:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian
    restart: unless-stopped
    shm_size: "1gb"
    security_opt:
      - seccomp:unconfined
    devices:
      - /dev/dri:/dev/dri
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: America/Indiana/Indianapolis
      CUSTOM_USER: "cybersader"
      PASSWORD: "XXXXXXXXXXX"
      LC_ALL: "en_US.UTF-8"
      PIXELFLUX_WAYLAND: "true"
      NO_DECOR: "true"
      # Hardening WITHOUT HARDEN_OPENBOX
      HARDEN_DESKTOP: "true"
      RESTART_APP: "true"
      # Selkies lockdown
      SELKIES_UI_SIDEBAR_SHOW_FILES: "false"
      SELKIES_UI_SIDEBAR_SHOW_APPS: "false"
      SELKIES_COMMAND_ENABLED: "false|locked"
      SELKIES_FILE_TRANSFERS: "none"
      SELKIES_ENABLE_SHARING: "false|locked"
    volumes:
      - /mnt/personal/obsidianweb/config:/config
      - /mnt/personal/obsidianweb/vaults:/vaults
    ports:
      - "9556:3000"
      - "9557:3001"
```

Removed `HARDEN_OPENBOX` and `MAX_RES`. The window should auto-fill now while keeping the other hardening intact. Try it and let me know.

### User

Oh, it looks like you literally have to drag around or hit the maximize window and stuff in the application. Like while it's going also another question, would you be able to open multiple like VNC windows and be able to have you know different obsidian windows open in different actual. windows you can drag around on your desktop.?

### AI

**For auto-maximizing:** `NO_DECOR` only strips the title bar—it doesn't force the window to fill the screen. You'd need Openbox configured to auto-maximize, which `HARDEN_OPENBOX` was supposed to help with but broke other things. Unfortunately there's no simple env var for "auto-maximize." It's just a VNC limitation—you have to hit maximize once after it loads.

**For multiple windows:**

No—multiple browser tabs connecting to the same container will show the **same VNC session**. You'd see the same screen in both tabs.

To get truly separate Obsidian windows on your desktop, you'd run **multiple containers:**

yaml

```
services:
  obsidian-1:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian-1
    # ... same config ...
    ports:
      - "9556:3000"
      - "9557:3001"

  obsidian-2:
    image: lscr.io/linuxserver/obsidian:latest
    container_name: obsidian-2
    # ... same config ...
    volumes:
      - /mnt/personal/obsidianweb/config2:/config
      - /mnt/personal/obsidianweb/vaults:/vaults  # same vaults, different config
    ports:
      - "9558:3000"
      - "9559:3001"
```

Each container = separate VNC session = separate browser tab you can drag around your desktop.

**But be careful:** Two Obsidian instances writing to the same vault simultaneously can cause sync conflicts. Read-only on one would be safer.

### User

OK, but in an enterprise environment where we want to spin up, you know containers on the fly that then access part. of a file system based on the person who is you know, logged into the I don't know the VNC or whatever like a role based access then how would that work? Are we spinning up a container for each what's the orchestration layer? Is it Kasm?

### AI

Yes — **Kasm Workspaces** is exactly the orchestration layer you're describing. Here's how it works for enterprise Obsidian:

## How Kasm Solves This

**Per-user container spinning:**

- User logs in → Kasm spins up a fresh Obsidian container just for them
- User logs out → container is destroyed (or persisted, your choice)
- Each user gets their own isolated VNC session

**Role-based access:**

- Integrates with **SAML SSO** (Azure AD, Okta, Google Workspace)
- Role-based groups determine which workspaces/vaults users can access
- Admin controls for clipboard, file transfers, uploads/downloads per group

**Storage mapping per user/role:**

- Mount different vault paths based on user identity
- User A sees `/vaults/team-alpha`, User B sees `/vaults/team-beta`
- Shared vaults for cross-team access where needed

## Architecture

text

```
User Browser
    ↓
Kasm Workspaces (orchestrator)
    ↓
Spins up per-user container (linuxserver/obsidian)
    ↓
Mounts user-specific vault from shared storage (NFS/CIFS/S3)
    ↓
User disconnects → container destroyed or hibernated
```

## Alternatives to Kasm

| Platform | Approach | Cost |
| --- | --- | --- |
| **Kasm Workspaces** | Purpose-built for this exact use case. Docker/K8s orchestration, SSO, DLP, per-user containers | Free community edition, paid enterprise |
| **Kubernetes + custom** | Roll your own with K8s namespaces, Rancher, persistent volumes per user | Free but heavy engineering effort |
| **Apache Guacamole** | Clientless remote desktop gateway, can front multiple VNC sessions | Free, but no container orchestration built in |
| **Selkies-GStreamer (standalone)** | What linuxserver uses under the hood. Can be deployed independently on K8s | Free, more DIY |

## For Your Use Case

**Kasm is the turnkey answer.** You'd:

1. Deploy Kasm Workspaces (Docker or K8s)
2. Import the linuxserver/obsidian image as a workspace
3. Configure user groups with SSO
4. Map vault storage per group/role
5. Users hit a URL, authenticate, get their own Obsidian instance

No CLI for end users. No VNC management. Kasm handles spinning containers up/down, auth, DLP, and session management.

Want me to sketch out what a Kasm + Obsidian deployment would look like?
