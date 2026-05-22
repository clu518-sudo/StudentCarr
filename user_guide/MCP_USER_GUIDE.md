# StudentCarr MCP — User Guide

Connect Claude Desktop to your Gmail through StudentCarr. Once set up, you can ask Claude things like *"show me my latest job application emails"* and it will fetch them from your Gmail via StudentCarr's pipeline.

---

## What this does

StudentCarr exposes one MCP tool to Claude Desktop:

- **`process_track`** — sends a routing message to StudentCarr. The supported command today is `getEmails`, which:
  1. Syncs your Gmail with StudentCarr,
  2. Aggregates job-application emails per application,
  3. Returns the full email details (subject, body, thread).

You stay in control: Claude Desktop never sees your Gmail credentials. It only holds a StudentCarr API key, which you can revoke at any time.

---

## Prerequisites

Before you begin, make sure you have:

1. **A StudentCarr account** with Gmail connected.
   - Sign in to the web app and go to **Progress Tracking**.
   - Complete the Gmail OAuth flow. The status should show *connected*.
2. **Claude Desktop** installed on your machine (Mac or Windows).
3. **Node.js 18.17+** installed (only needed if you use the manual `npx` setup instead of the `.mcpb` bundle).

---

## Setup — the easy way (recommended)

The web app can build a one-click installer for Claude Desktop with your API key pre-filled.

### 1. Open the setup page

In the StudentCarr web app, open **Connect to Claude Desktop**.

> If you see a yellow banner saying "Connect your Gmail first", finish Gmail OAuth on the Progress Tracking page before continuing.

### 2. Generate an API key

- (Optional) Type a label like `Laptop Claude Desktop` so you remember which device this key lives on.
- Click **Generate API key**.
- A green panel appears with your raw key (e.g. `sc_xxxxxxxxxxxxxxxx`).

> **Important:** This is the **only** time the raw key is ever shown. The server only stores a hash of it. Copy it now, or use the bundle download (next step), which embeds it for you.

### 3. Download the Claude Desktop bundle

In the same green panel, click **Download Claude Desktop bundle (.mcpb)**.

A file named `studentcarr.mcpb` will download. This is a Claude Desktop extension bundle with:
- the MCP server code,
- a manifest pre-configured with your API key and the StudentCarr API URL.

### 4. Install in Claude Desktop

Double-click the `studentcarr.mcpb` file.

Claude Desktop will open an install dialog. The API key and API URL fields are already filled in — just confirm and click **Install**.

### 5. Verify

Open a new chat in Claude Desktop and try:

> *"Use StudentCarr to fetch my latest job application emails."*

Claude should call `process_track` with `message: "getEmails"` and reply with a summary of your latest application emails.

---

## Setup — manual (advanced)

If you'd rather not use the bundle, you can wire up the MCP server by editing Claude Desktop's config file directly.

### 1. Generate an API key

Follow steps 1–2 from the easy path above. Copy the raw key when it appears — you cannot retrieve it later.

### 2. Copy the config snippet

On the same setup page, the **Claude Desktop MCP config** card shows JSON like:

```json
{
  "mcpServers": {
    "studentcarr-gmail": {
      "command": "npx",
      "args": ["-y", "studentcarr-mcp-server"],
      "env": {
        "STUDENTCARR_API_KEY": "sc_YOUR_KEY_HERE",
        "STUDENTCARR_API_URL": "https://your-api-host"
      }
    }
  }
}
```

Click **Copy snippet**.

If you generated the key in this session, `STUDENTCARR_API_KEY` is already filled in. If not, paste your raw key in place of `sc_YOUR_KEY_HERE`.

### 3. Paste into `claude_desktop_config.json`

Open Claude Desktop's MCP config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Paste the snippet. If the file already has an `mcpServers` block, merge the `studentcarr-gmail` entry into it instead of replacing the whole file.

### 4. Restart Claude Desktop

Quit Claude Desktop completely and reopen it. The new MCP server is loaded on startup.

### 5. Verify

Same as the easy path: ask Claude to fetch your latest job application emails and confirm it returns data.

---

## Usage

Once connected, you can prompt Claude naturally. Examples:

- *"Sync my Gmail with StudentCarr and show me what came in."*
- *"Pull my latest job application emails."*
- *"Summarize the most recent application updates from my inbox."*

Under the hood, Claude calls the `process_track` tool with `message: "getEmails"`, which triggers a fresh sync and returns the aggregated emails. More commands will be added over time — Claude will discover them automatically through the tool's description.

---

## Managing your keys

On the **Connect to Claude Desktop** page, the **Active keys** card lists every key you've generated:

| Field        | What it means                                                   |
|--------------|-----------------------------------------------------------------|
| Label        | What you named it when generating.                              |
| Masked key   | The first/last few characters so you can identify it.           |
| Created      | When it was generated.                                          |
| Last used    | Last time Claude Desktop made a call with this key.             |

Click **Revoke** to disable a key. **Any Claude Desktop instance using that key will stop working immediately.** Generate a new key and re-install if you need to keep that device connected.

Good hygiene:

- Use a separate label per device (e.g. `Laptop`, `Work Mac`).
- Revoke unused keys.
- Revoke and rotate immediately if you suspect a key was leaked.

---

## Troubleshooting

### "StudentCarr rejected the API key (401)"

Your key has been revoked, deleted, or pasted incorrectly.
- Open **Connect to Claude Desktop** and generate a fresh key.
- Either re-download the `.mcpb` bundle, or update `STUDENTCARR_API_KEY` in your `claude_desktop_config.json` and restart Claude Desktop.

### "StudentCarr says Gmail is not connected (403)"

The backend can't reach your Gmail. Usually the Gmail token expired or was revoked from your Google account.
- Open the web app → **Progress Tracking** → reconnect Gmail.
- Retry the request in Claude Desktop.

### "Network error contacting StudentCarr at ..."

The MCP server can't reach the API URL.
- Check the value of `STUDENTCARR_API_URL` in your config or `.mcpb` install dialog. It should be the **origin only** (e.g. `https://studentcarr.example.com`) — no `/api` suffix.
- Confirm the StudentCarr backend is running and reachable from your machine.

### "Unknown tool" or Claude doesn't see StudentCarr

- Make sure you fully restarted Claude Desktop after editing the config.
- For the manual setup, check that `claude_desktop_config.json` is valid JSON (a missing comma will silently disable all servers).
- Check the Claude Desktop logs — on macOS run `Console.app` and filter for "Claude"; on Windows logs live under `%APPDATA%\Claude\logs`.

### Empty results from `getEmails`

A successful sync that returns no emails just means StudentCarr didn't find any job-application emails to surface in your recent Gmail. Try sending yourself a test application email and rerun.

---

## Security notes

- The raw API key is shown **exactly once**, on the screen where you generate it. After that the backend only has a hash — it cannot recover or resend the key.
- Treat the key like a password. Don't commit it to git, paste it in screenshots, or share it in chats.
- Revoking a key takes effect immediately on the next request.
- All MCP requests use HTTPS in production. Keys are never logged in plain text.

---

## What's next

This guide covers the current `getEmails` flow. As StudentCarr adds more MCP commands (e.g. drafting replies, marking applications), they will appear automatically — Claude Desktop reads the tool description on connect, so no config changes are needed. Watch the **Connect to Claude Desktop** page for new command tags.
