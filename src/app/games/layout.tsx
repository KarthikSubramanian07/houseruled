import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Games",
  description:
    "Browse classic card games and community house-rule variants. Pick one and open a table with friends.",
  alternates: {
    canonical: "/games",
  },
  openGraph: {
    title: "Games · Houseruled",
    description:
      "Browse classic card games and community house-rule variants. Pick one and open a table with friends.",
    url: "/games",
  },
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
