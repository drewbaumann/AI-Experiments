# Magnet Relay

Share magnet URLs and automatically download to the right folder on your Mac.

## What it does

1. You share a magnet URL (from iOS, web, or command line)
2. It auto-detects the content type (movie, TV show, book, etc.)
3. You confirm/adjust the details
4. It sends to Transmission with the correct download directory

## Quick Start

```bash
cd magnet-relay

# Install dependencies
bundle install

# Copy and edit config
cp config/settings.yml.example config/settings.yml
# Edit settings.yml with your paths and Transmission settings

# Start the server
./bin/magnet server

# Or use the CLI directly
./bin/magnet add "magnet:?xt=urn:btih:..."
```

## Configuration

### settings.yml

```yaml
# Where your media lives
download:
  base_path: "/Volumes/Media"
  auto_create_dirs: true

# Transmission connection (must be running with RPC enabled)
transmission:
  host: "127.0.0.1"
  port: 9091
  username: ""           # Leave empty if no auth
  password: ""
  require_vpn: true      # Check for VPN before downloading
  vpn_interface: "utun"  # VPN interface prefix (utun for most macOS VPNs)

# Server settings
server:
  host: "0.0.0.0"
  port: 4567
  api_key: ""            # Optional auth for remote access
```

### categories.yml

Define where each content type goes using friendly path templates:

```yaml
categories:
  movie:
    name: "Movie"
    path: "Movies/{title} ({year})"
    fields: [title, year]

  show:
    name: "TV Show"
    path: "TV Shows/{show_name}/Season {season}"
    fields: [show_name, season]

  book:
    name: "Book"
    path: "Books/{author}"
    fields: [author, title]
```

**Placeholders:**
- `{title}` - Content title
- `{year}` - Release year
- `{show_name}` - TV show name
- `{season}` - Season number (01, 02, etc.)
- `{author}` - Author name
- `{artist}` - Artist name
- `{album}` - Album name

## Usage

### Web Interface

Open `http://localhost:4567` in your browser. Paste a magnet URL and it will:
- Auto-detect the content type
- Extract metadata (title, year, season, etc.)
- Show you the download path
- Let you adjust before submitting

### Command Line

```bash
# Add a magnet (auto-detect everything)
./bin/magnet add "magnet:?xt=urn:btih:..."

# Override category
./bin/magnet add "magnet:..." -c show

# Specify metadata
./bin/magnet add "magnet:..." -c show -s "Breaking Bad" -n 5

# Preview without adding
./bin/magnet add "magnet:..." --dry-run

# Analyze a magnet URL
./bin/magnet analyze "magnet:..."

# Check status
./bin/magnet status

# List categories
./bin/magnet categories
```

### iOS Shortcut

Create a Shortcut that:
1. Accepts Share Sheet input (Text/URLs)
2. Extracts magnet URL with regex: `magnet:\?.*`
3. POSTs to your server:

```
URL: http://your-mac.local:4567/api/add
Method: POST
Headers:
  Content-Type: application/json
  X-API-Key: your-api-key
Body:
  {"magnet": "[extracted URL]", "category": "show"}
```

4. Shows notification with result

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server and Transmission status |
| `/api/categories` | GET | List available categories |
| `/api/analyze` | POST | Analyze a magnet URL |
| `/api/preview` | POST | Preview download path |
| `/api/add` | POST | Add magnet to Transmission |

**POST /api/add**
```json
{
  "magnet": "magnet:?xt=urn:btih:...",
  "category": "show",
  "metadata": {
    "show_name": "Breaking Bad",
    "season": "05"
  }
}
```

## Transmission Setup

Enable Remote Access in Transmission preferences:
- Preferences → Remote → Enable remote access
- Default port: 9091
- Set username/password if desired

## VPN Notes

The system can check for an active VPN before adding downloads. This is controlled by:

```yaml
transmission:
  require_vpn: true
  vpn_interface: "utun"
```

**Options:**
- `require_vpn: true` - Won't add downloads unless VPN is active
- `require_vpn: false` - Skip VPN check
- `vpn_interface` - The interface prefix to look for (most VPNs use `utun` on macOS)

**Tailscale + VPN:** These can conflict. Options:
1. Use PIA for downloads, access relay on local network only
2. Configure PIA split tunneling to exclude Tailscale
3. Use Tailscale exit node routing through a VPN server

## Directory Structure

The system creates directories as needed. Example result:

```
/Volumes/Media/
├── Movies/
│   └── Inception (2010)/
│       └── Inception.2010.1080p.BluRay.mkv
├── TV Shows/
│   └── Breaking Bad/
│       └── Season 05/
│           └── Breaking.Bad.S05E01.mkv
├── Books/
│   └── Stephen King/
│       └── The Shining.epub
└── Music/
    └── Pink Floyd/
        └── Dark Side of the Moon/
            └── ...
```

## Running as a Service (macOS)

Create `~/Library/LaunchAgents/com.user.magnet-relay.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.magnet-relay</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/env</string>
        <string>ruby</string>
        <string>/path/to/magnet-relay/bin/magnet</string>
        <string>server</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/magnet-relay</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.user.magnet-relay.plist
```

## License

MIT
