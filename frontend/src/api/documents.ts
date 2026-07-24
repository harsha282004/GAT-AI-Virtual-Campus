import { apiClient } from "@/api/client";
import type { CampusDocument } from "@/types";

export const documentsApi = {
  list: async (): Promise<CampusDocument[]> => {
    const { data } = await apiClient.get<CampusDocument[]>("/documents");
    return data;
  },
};
