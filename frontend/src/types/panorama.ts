export interface Panorama {
  id: number;
  node_id: number;
  image_path: string;
  title: string | null;
  is_placeholder: boolean;
  created_at: string;
  updated_at: string;
}
