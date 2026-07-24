import { useQuery } from "@tanstack/react-query";

import { documentsApi } from "@/api/documents";

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: documentsApi.list,
    staleTime: 5 * 60 * 1000,
  });
}
