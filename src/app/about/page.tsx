import { ProsePage, proseMetadata } from "@/components/ProsePage";
import { ABOUT } from "@/agent/content";

export const metadata = proseMetadata(ABOUT);

export default function Page() {
  return <ProsePage doc={ABOUT} />;
}
