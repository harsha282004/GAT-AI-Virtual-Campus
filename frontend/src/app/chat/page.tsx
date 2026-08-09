import { PageContainer, SectionTitle } from "@/components/ui";
import { ChatWindow } from "@/features/chat";

export default function ChatPage() {
  return (
    <PageContainer narrow>
      <SectionTitle
        eyebrow="AI Assistant"
        title="Ask the GAT Assistant"
        align="left"
        subtitle="Ask about admissions, academics, campus facilities, or getting around campus."
        className="mx-0"
      />

      <ChatWindow />
    </PageContainer>
  );
}
