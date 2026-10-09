// schema.org structured data for every page (rendered in the root layout).
// Organization carries contactPoint + PostalAddress so agents and search
// engines can verify who runs Houseruled and how to reach them.

import { CONTACT_EMAIL, REPO_URL } from "../lib/env";

export function structuredData(siteUrl: string, description: string) {
  const org = `${siteUrl}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: "Houseruled",
        url: siteUrl,
        logo: `${siteUrl}/icon.svg`,
        description: "Independent maker of Houseruled, a free online card table for playing card games with friends using house rules.",
        email: CONTACT_EMAIL,
        founder: { "@type": "Person", name: "Karthik Subramanian" },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: CONTACT_EMAIL,
          url: `${siteUrl}/contact`,
          availableLanguage: ["en"],
        },
        address: {
          "@type": "PostalAddress",
          addressLocality: "Berkeley",
          addressRegion: "CA",
          addressCountry: "US",
        },
        sameAs: [REPO_URL],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Houseruled",
        url: siteUrl,
        publisher: { "@id": org },
      },
      {
        "@type": "WebApplication",
        name: "Houseruled",
        url: siteUrl,
        applicationCategory: "GameApplication",
        operatingSystem: "Any (web browser)",
        description,
        browserRequirements: "Requires a modern web browser. No download required.",
        publisher: { "@id": org },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
}
