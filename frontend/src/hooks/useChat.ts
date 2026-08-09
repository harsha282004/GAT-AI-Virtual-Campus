import { useMutation } from "@tanstack/react-query";

import { chatApi } from "@/api/chat";

export function useChatSend() {
  return useMutation({
    mutationFn: ({ message, sessionId }: { message: string; sessionId?: string | null }) =>
      chatApi.send(message, sessionId),
  });
}
