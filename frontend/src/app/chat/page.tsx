import { PageContainer, SectionTitle } from "@/components/ui";
import { ChatWindow, SuggestedQuestions } from "@/features/chat";

export default function ChatPage() {
  return (
    <PageContainer>
      <SectionTitle
        eyebrow="AI Assistant"
        title="Ask the GAT Assistant"
        align="left"
        subtitle="Ask about admissions, academics, campus facilities, or getting around campus."
        className="mx-0"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <SuggestedQuestions />
        <ChatWindow />
      </div>
    </PageContainer>
  );
}
