import { ProsePage, proseMetadata } from "@/components/ProsePage";
import { DEVELOPERS } from "@/agent/content";

export const metadata = proseMetadata(DEVELOPERS);

export default function Page() {
  return <ProsePage doc={DEVELOPERS} />;
}
