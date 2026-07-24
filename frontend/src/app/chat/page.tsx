import { Info } from "lucide-react";

import { PageContainer, SectionTitle } from "@/components/ui";
import { ChatWindow } from "@/features/chat";

export default function ChatPage() {
  return (
    <PageContainer narrow>
      <SectionTitle
        eyebrow="AI Assistant"
        title="Ask the GAT Assistant"
        align="left"
        subtitle="Try out the chat interface below."
        className="mx-0"
      />

      <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-gat-gold/30 bg-gat-gold/10 px-4 py-3 text-sm text-gat-gold-dark">
        <Info className="h-4 w-4 shrink-0" />
        <p>Backend integration coming in AI Phase.</p>
      </div>

      <ChatWindow />
    </PageContainer>
  );
}
