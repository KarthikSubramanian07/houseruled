import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { InventGame } from "@/components/game/InventGame";

export const metadata: Metadata = {
  title: "Invent a game",
  description: "Describe a card game in a sentence and let the AI build it — then play it with friends.",
};

export default function InventPage() {
  return (
    <>
      <header className="px-6 py-5 sm:px-10">
        <Wordmark size="sm" />
      </header>
      <main className="flex flex-1 flex-col px-5 pb-16 pt-4 sm:px-8">
        <InventGame />
      </main>
    </>
  );
}
