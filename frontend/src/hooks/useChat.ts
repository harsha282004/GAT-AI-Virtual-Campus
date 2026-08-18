import { useMutation } from "@tanstack/react-query";

import { chatApi } from "@/api/chat";

export function useChatSend() {
  return useMutation({
    mutationFn: ({
      message,
      sessionId,
      language,
    }: {
      message: string;
      sessionId?: string | null;
      language?: string | null;
    }) => chatApi.send(message, sessionId, language),
  });
}
