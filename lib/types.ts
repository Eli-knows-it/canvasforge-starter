export type Site = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  html: string;
  css: string;
  javascript: string;
  project_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
