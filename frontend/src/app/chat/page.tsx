import { PageContainer } from "@/components/ui";
import { ChatWindow } from "@/features/chat";

export default function ChatPage() {
  return (
    <PageContainer>
      <div className="mx-auto mt-4 max-w-4xl">
        <ChatWindow />
      </div>
    </PageContainer>
  );
}
