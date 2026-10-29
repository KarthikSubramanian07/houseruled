import { describe, expect, it } from "vitest";
import { structuredData } from "./jsonld";

describe("structuredData", () => {
  const graph = structuredData("https://playhouseruled.pages.dev", "desc")["@graph"];
  const org = graph.find((n) => n["@type"] === "Organization") as Record<string, unknown> & {
    contactPoint: Record<string, unknown>;
    address: Record<string, unknown>;
  };

  it("includes an Organization with contactPoint and PostalAddress", () => {
    expect(org).toBeDefined();
    expect(org.contactPoint).toMatchObject({ "@type": "ContactPoint", contactType: "customer support", url: expect.stringContaining("/contact") });
    // No personal email is published unless NEXT_PUBLIC_CONTACT_EMAIL is set.
    expect(org.contactPoint).not.toHaveProperty("email");
    expect(org).not.toHaveProperty("email");
    expect(org.address).toMatchObject({ "@type": "PostalAddress", addressLocality: "Berkeley", addressRegion: "CA", addressCountry: "US" });
  });

  it("links the website and app to the organization", () => {
    for (const type of ["WebSite", "WebApplication"]) {
      expect(graph.find((n) => n["@type"] === type)).toMatchObject({ publisher: { "@id": org["@id"] } });
    }
  });

  it("keeps the app free", () => {
    expect(graph.find((n) => n["@type"] === "WebApplication")).toMatchObject({ offers: { price: "0" } });
  });
});
