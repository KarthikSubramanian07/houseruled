import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { InventGame } from "@/components/game/InventGame";

export const metadata: Metadata = {
  title: "Invent a game",
  description: "Describe a card game in a sentence and let the AI build it - then play it with friends.",
};

export default function InventPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col px-5 pb-16 pt-4 sm:px-8">
        <InventGame />
      </main>
      <SiteFooter />
    </>
  );
}
