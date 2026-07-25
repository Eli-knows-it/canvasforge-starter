export type Site = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  html: string;
  css: string;
  javascript: string;
  project_data: Record<string, unknown> | null;
  is_published: boolean;
  published_at: string | null;
  form_email: string | null;
  created_at: string;
  updated_at: string;
};
