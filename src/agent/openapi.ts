// OpenAPI 3.1 description of the public, read-only JSON API (served at
// /openapi.json). Write endpoints back the web client and stay undocumented.

import { GAME_CATALOG } from "../lib/engine/registry";
import { CONTACT_EMAIL } from "../lib/env";

export function openApiSpec(siteUrl: string) {
  const communityGame = {
    type: "object",
    required: ["slug", "title", "baseGame", "ruleTexts", "explanation", "plays", "creatorId", "creatorName"],
    properties: {
      slug: { type: "string", examples: ["twos-are-chaos"] },
      title: { type: "string" },
      baseGame: { type: "string", enum: GAME_CATALOG.map((g) => g.type) },
      ruleTexts: { type: "array", items: { type: "string" }, description: "House rules in plain English." },
      explanation: { type: "string" },
      plays: { type: "integer", minimum: 0 },
      creatorId: { type: ["string", "null"] },
      creatorName: { type: ["string", "null"] },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Houseruled API",
      version: "1.0.0",
      summary: "Read the Houseruled community library of player-invented card games.",
      description:
        "Public, unauthenticated, read-only endpoints. For card game rules and house-rule variants, use the MCP server at /mcp. See /developers.",
      contact: { name: "Houseruled", email: CONTACT_EMAIL, url: `${siteUrl}/contact` },
      license: { name: "MIT", identifier: "MIT" },
    },
    servers: [{ url: siteUrl }],
    externalDocs: { url: `${siteUrl}/developers`, description: "Houseruled developer docs" },
    paths: {
      "/api/games": {
        get: {
          operationId: "listCommunityGames",
          summary: "List community games",
          parameters: [
            { name: "search", in: "query", schema: { type: "string" }, description: "Match titles and descriptions." },
            { name: "base", in: "query", schema: { type: "string" }, description: "Base game id, e.g. crazyeights." },
            { name: "sort", in: "query", schema: { type: "string", enum: ["plays", "new"], default: "plays" } },
          ],
          responses: {
            "200": {
              description: "Matching games (up to 50).",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["games", "favorites"],
                    properties: {
                      games: { type: "array", items: { $ref: "#/components/schemas/CommunityGame" } },
                      favorites: { type: "array", items: { type: "string" }, description: "Empty unless ?user= is sent." },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/games/{slug}": {
        get: {
          operationId: "getCommunityGame",
          summary: "Get one community game",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "The game.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok", "game"],
                    properties: { ok: { const: true }, game: { $ref: "#/components/schemas/CommunityGame" } },
                  },
                },
              },
            },
            "404": {
              description: "No public game with that slug.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { ok: { const: false }, error: { const: "not_found" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: { schemas: { CommunityGame: communityGame } },
  };
}
