import { ProsePage, proseMetadata } from "@/components/ProsePage";
import { CONTACT } from "@/agent/content";

export const metadata = proseMetadata(CONTACT);

export default function Page() {
  return <ProsePage doc={CONTACT} />;
}
