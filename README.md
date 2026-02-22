# Capacities MCP Server

An MCP server enabling Claude to interact directly with **Capacities**.

This integration allows Claude (Desktop and Mobile) to create and
retrieve content inside Capacities using natural language workflows.

------------------------------------------------------------------------

## Overview

The server exposes Capacities functionality through the Model Context
Protocol (MCP), allowing Claude to:

-   write content to Daily Notes
-   save links with metadata
-   access user spaces
-   look up existing knowledge objects

The same server can be used across Claude Desktop and Claude Mobile via
a hosted endpoint.

------------------------------------------------------------------------

## Implemented MCP Tools

  -----------------------------------------------------------------------
  Tool                                Description
  ----------------------------------- -----------------------------------
  `capacities_save_to_daily_note`     Saves markdown content to today's
                                      Daily Note

  `capacities_save_weblink`           Stores a web link with notes and
                                      tags

  `capacities_get_spaces`             Returns available Capacities spaces

  `capacities_lookup`                 Searches existing content by title
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## Architecture

    Claude
       ↓ MCP
    Capacities MCP Server
       ↓ API
    Capacities

------------------------------------------------------------------------

## Use Case

Example workflow:

> "Save this idea to my Daily Note in Capacities"

Claude → MCP tool → Capacities API → Daily Note updated automatically.

This enables Capacities to function as a persistent knowledge layer for
Claude.

------------------------------------------------------------------------

## Deployment

The server can run locally (Claude Desktop) or be hosted (e.g. Railway)
to support mobile clients.

------------------------------------------------------------------------

## Railway (Hosted MCP)

If you deploy this server on Railway, use HTTP transport:

- `TRANSPORT=http`
- `CAPACITIES_TOKEN=<your_capacities_token>`
- `CAPACITIES_SPACE_ID=<your_space_id>`
- `PORT` is provided by Railway automatically

MCP endpoint:

- `https://<your-railway-domain>/mcp`

Health check:

- `https://<your-railway-domain>/`

For Railway/remote usage, do not use `stdio`; `stdio` is only for local
Claude Desktop launch via `command` + `args`.

------------------------------------------------------------------------

## Claude Desktop MCP Setup (macOS)

1. Build the server:

```bash
npm install
npm run build
```

2. Open Claude Desktop config file:

`~/Library/Application Support/Claude/claude_desktop_config.json`

3. Add this config:

```json
{
  "mcpServers": {
    "capacities": {
      "command": "node",
      "args": [
        "/Users/shpak/Desktop/development/capacities-mcp-server/dist/index.js"
      ],
      "env": {
        "TRANSPORT": "stdio",
        "CAPACITIES_TOKEN": "PASTE_YOUR_CAPACITIES_TOKEN_HERE",
        "CAPACITIES_SPACE_ID": "PASTE_YOUR_SPACE_ID_HERE"
      }
    }
  }
}
```

4. Restart Claude Desktop.

------------------------------------------------------------------------

## Purpose

This project demonstrates how Capacities can be integrated into
AI-native workflows using MCP, enabling seamless capture and retrieval
of knowledge directly from conversational interfaces.
