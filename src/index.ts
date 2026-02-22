import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

// ─── Config ────────────────────────────────────────────────────────────────
const API_TOKEN = process.env.CAPACITIES_TOKEN ?? "";
const DEFAULT_SPACE_ID = process.env.CAPACITIES_SPACE_ID ?? "";
const API_BASE = "https://api.capacities.io";

if (!API_TOKEN) {
  process.stderr.write("ERROR: CAPACITIES_TOKEN env var is required\n");
  process.exit(1);
}

// ─── HTTP helper ────────────────────────────────────────────────────────────
async function capacitiesRequest<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  params?: Record<string, string>
): Promise<T> {
  let url = `${API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url = `${url}?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Capacities API error ${res.status}: ${text}`);
  }

  const responseText = await res.text();
  if (!responseText || responseText.trim() === "") {
    return {} as T;
  }
  return JSON.parse(responseText) as T;
}

// ─── Server ─────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "capacities-mcp-server",
  version: "1.0.0",
});

// ─── Tool: save_to_daily_note ────────────────────────────────────────────────
server.registerTool(
  "capacities_save_to_daily_note",
  {
    title: "Save to Capacities Daily Note",
    description: `Saves text (markdown supported) to today's Daily Note in Capacities.

Use this to capture insights, ideas, tasks, meeting notes — anything you want to land in Capacities right now.

Args:
  - text (string): Markdown text to save. Supports headers, lists, bold, links, tasks [ ]
  - spaceId (string, optional): Target space ID. Uses default space if omitted.
  - noTimestamp (boolean, optional): If true, skips automatic timestamp prefix. Default: false.

Returns:
  Confirmation message with the text that was saved.

Examples:
  - "Save this insight: ..." → text="..."
  - "Add task: ..." → text="[ ] task"`,
    inputSchema: z.object({
      text: z
        .string()
        .min(1)
        .max(200000)
        .describe("Markdown text to save to today's Daily Note"),
      spaceId: z
        .string()
        .uuid()
        .optional()
        .describe("Space ID (uses default if omitted)"),
      noTimestamp: z
        .boolean()
        .optional()
        .default(false)
        .describe("Skip timestamp prefix"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ text, spaceId, noTimestamp }) => {
    const targetSpace = spaceId ?? DEFAULT_SPACE_ID;
    if (!targetSpace) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: No spaceId provided and CAPACITIES_SPACE_ID is not set.",
          },
        ],
      };
    }

    await capacitiesRequest("/save-to-daily-note", "POST", {
      spaceId: targetSpace,
      mdText: text,
      ...(noTimestamp ? { noTimeStamp: true } : {}),
    });

    const preview = text.length > 200 ? text.slice(0, 200) + "…" : text;
    return {
      content: [
        {
          type: "text" as const,
          text: `✅ Сохранено в Daily Note:\n\n${preview}`,
        },
      ],
    };
  }
);

// ─── Tool: save_weblink ───────────────────────────────────────────────────────
server.registerTool(
  "capacities_save_weblink",
  {
    title: "Save Weblink to Capacities",
    description: `Saves a URL to Capacities as a Weblink object with optional notes and tags.

Use when you want to bookmark a page, article, tool, or resource directly into your knowledge base.

Args:
  - url (string): The URL to save
  - title (string, optional): Custom title (fetched from URL if omitted)
  - description (string, optional): Custom description
  - notes (string, optional): Markdown notes to attach to the link
  - tags (string[], optional): Array of tag names (created if they don't exist)
  - spaceId (string, optional): Target space ID

Returns:
  Confirmation with the saved weblink details.`,
    inputSchema: z.object({
      url: z.string().url().describe("URL to save"),
      title: z.string().max(500).optional().describe("Custom title override"),
      description: z
        .string()
        .max(1000)
        .optional()
        .describe("Custom description override"),
      notes: z
        .string()
        .max(200000)
        .optional()
        .describe("Markdown notes to attach"),
      tags: z
        .array(z.string())
        .max(30)
        .optional()
        .describe("Tag names to apply"),
      spaceId: z
        .string()
        .uuid()
        .optional()
        .describe("Space ID (uses default if omitted)"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ url, title, description, notes, tags, spaceId }) => {
    const targetSpace = spaceId ?? DEFAULT_SPACE_ID;
    if (!targetSpace) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: No spaceId provided and CAPACITIES_SPACE_ID is not set.",
          },
        ],
      };
    }

    interface WeblinkResponse {
      title?: string;
      id?: string;
    }

    const result = await capacitiesRequest<WeblinkResponse>(
      "/save-weblink",
      "POST",
      {
        spaceId: targetSpace,
        url,
        ...(title ? { titleOverwrite: title } : {}),
        ...(description ? { descriptionOverwrite: description } : {}),
        ...(notes ? { mdText: notes } : {}),
        ...(tags ? { tags } : {}),
      }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: `✅ Ссылка сохранена в Capacities:\n\n**${result.title ?? url}**\n${url}\n\nID: ${result.id ?? "n/a"}`,
        },
      ],
    };
  }
);

// ─── Tool: get_spaces ─────────────────────────────────────────────────────────
server.registerTool(
  "capacities_get_spaces",
  {
    title: "Get Capacities Spaces",
    description: `Returns a list of your Capacities spaces with their IDs and titles.
Useful to find the correct spaceId when you have multiple spaces.`,
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    interface SpacesResponse {
      spaces: Array<{ id: string; title: string }>;
    }

    const { spaces } = await capacitiesRequest<SpacesResponse>(
      "/spaces",
      "GET"
    );

    const formatted = spaces
      .map((s) => `• **${s.title}** — \`${s.id}\``)
      .join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `📚 Твои Capacities spaces:\n\n${formatted}`,
        },
      ],
    };
  }
);

// ─── Tool: lookup_content ─────────────────────────────────────────────────────
server.registerTool(
  "capacities_lookup",
  {
    title: "Lookup Content in Capacities",
    description: `Searches for existing content in Capacities by title/name.
Returns matching object IDs and their types. Useful before linking or referencing existing notes.

Args:
  - searchTerm (string): Text to search for in object titles
  - spaceId (string, optional): Space to search in`,
    inputSchema: z.object({
      searchTerm: z.string().min(1).describe("Title to search for"),
      spaceId: z
        .string()
        .uuid()
        .optional()
        .describe("Space ID (uses default if omitted)"),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ searchTerm, spaceId }) => {
    const targetSpace = spaceId ?? DEFAULT_SPACE_ID;
    if (!targetSpace) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: No spaceId provided and CAPACITIES_SPACE_ID is not set.",
          },
        ],
      };
    }

    interface LookupResponse {
      results: Array<{ id: string; structureId: string; title: string }>;
    }

    const { results } = await capacitiesRequest<LookupResponse>(
      "/lookup",
      "POST",
      { searchTerm, spaceId: targetSpace }
    );

    if (!results.length) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Ничего не найдено по запросу: "${searchTerm}"`,
          },
        ],
      };
    }

    const formatted = results
      .map((r) => `• **${r.title}**\n  ID: \`${r.id}\`\n  Тип: ${r.structureId}`)
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `🔍 Результаты для "${searchTerm}":\n\n${formatted}`,
        },
      ],
    };
  }
);

// ─── Start ───────────────────────────────────────────────────────────────────
const TRANSPORT = process.env.TRANSPORT ?? "stdio";

async function runHttp(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check для Railway
  app.get("/", (_req, res) => {
    res.json({ status: "ok", name: "capacities-mcp-server" });
  });

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(port, () => {
    process.stderr.write(`Capacities MCP server running on http://0.0.0.0:${port}/mcp\n`);
  });
}

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Capacities MCP server started (stdio)\n");
}

if (TRANSPORT === "http") {
  runHttp().catch((err: unknown) => {
    process.stderr.write(`Fatal error: ${String(err)}\n`);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    process.stderr.write(`Fatal error: ${String(err)}\n`);
    process.exit(1);
  });
}