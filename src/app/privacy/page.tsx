import { ProsePage, proseMetadata } from "@/components/ProsePage";
import { PRIVACY } from "@/agent/content";

export const metadata = proseMetadata(PRIVACY);

export default function Page() {
  return <ProsePage doc={PRIVACY} />;
}
