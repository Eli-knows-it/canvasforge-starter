'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FormEvent,
  useEffect,
  useState
} from 'react';

import {
  defaultCss,
  defaultHtml
} from '@/lib/default-site';
import { getSupabase } from '@/lib/supabase';
import type { Site } from '@/lib/types';

function makeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 54) || 'new-site'
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return date.toLocaleString();
}

export function DashboardClient() {
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const publicBaseUrl =
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
    'https://canvasforge-starter.vercel.app/published';

  useEffect(() => {
    void loadSites();
  }, []);

  async function loadSites() {
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabase();

      const { data: authData } =
        await supabase.auth.getUser();

      if (!authData.user) {
        router.replace('/login');
        return;
      }

      const { data, error: fetchError } =
        await supabase
          .from('sites')
          .select('*')
          .order('updated_at', {
            ascending: false
          });

      if (fetchError) {
        throw fetchError;
      }

      setSites((data || []) as Site[]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load websites.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function createSite(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName = siteName.trim();

    if (!cleanName) {
      setError('Enter a website name.');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const supabase = getSupabase();

      const { data: authData } =
        await supabase.auth.getUser();

      if (!authData.user) {
        throw new Error(
          'Your session has expired. Please sign in again.'
        );
      }

      const slug =
        `${makeSlug(cleanName)}-` +
        crypto.randomUUID().slice(0, 6);

      const { data, error: insertError } =
        await supabase
          .from('sites')
          .insert({
            owner_id: authData.user.id,
            name: cleanName,
            slug,
            html: defaultHtml,
            css: defaultCss,
            javascript: '',
            project_data: null,
            is_published: false,
            published_at: null,
            form_email: null
          })
          .select('*')
          .single();

      if (insertError) {
        throw insertError;
      }

      setShowCreate(false);
      setSiteName('');

      router.push(`/editor/${data.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to create website.'
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteSite(site: Site) {
    const confirmed = window.confirm(
      `Delete “${site.name}”? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      const { error: deleteError } =
        await getSupabase()
          .from('sites')
          .delete()
          .eq('id', site.id);

      if (deleteError) {
        throw deleteError;
      }

      setSites((currentSites) =>
        currentSites.filter(
          (currentSite) =>
            currentSite.id !== site.id
        )
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to delete website.'
      );
    }
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    router.push('/login');
  }

  function getPublicUrl(site: Site): string {
    return (
      `${publicBaseUrl.replace(/\/$/, '')}/` +
      site.slug
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div>
          <div className="spinner" />
          <p>Loading your websites…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link
          href="/dashboard"
          className="logo"
        >
          <span className="logo-mark">C</span>
          CanvasForge
        </Link>

        <div className="nav-actions">
          <button
            type="button"
            className="button-secondary button-small"
            onClick={() => setShowCreate(true)}
          >
            + New website
          </button>

          <button
            type="button"
            className="button-ghost button-small"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="page">
        <div className="page-heading">
          <div>
            <h1>Your websites</h1>
            <p>
              Import code, edit visually, manage pages,
              and publish.
            </p>
          </div>

          <button
            type="button"
            className="button-primary"
            onClick={() => setShowCreate(true)}
          >
            Create website
          </button>
        </div>

        {error && (
          <div
            className="message-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="site-grid">
          {sites.length === 0 ? (
            <div className="empty-state">
              <h2>Create your first website</h2>
              <p>
                Start with a blank site, then paste code,
                import a ZIP, or build visually.
              </p>

              <button
                type="button"
                className="button-primary"
                onClick={() => setShowCreate(true)}
              >
                Create website
              </button>
            </div>
          ) : (
            sites.map((site) => {
              const publicUrl = getPublicUrl(site);

              return (
                <article
                  className="site-card"
                  key={site.id}
                >
                  <div className="site-preview">
                    <div className="site-preview-inner">
                      <div className="mini-line bold" />
                      <div className="mini-line" />
                      <div className="mini-line" />
                    </div>
                  </div>

                  <div className="site-card-body">
                    <h2 className="site-title">
                      {site.name}
                    </h2>

                    <p className="site-meta">
                      {site.is_published
                        ? 'Published'
                        : 'Draft'}
                      {' · '}
                      Updated{' '}
                      {formatUpdatedAt(site.updated_at)}
                    </p>

                    {site.is_published && (
                      <p className="site-live-url">
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {publicUrl}
                        </a>
                      </p>
                    )}

                    <div className="site-actions">
                      <Link
                        className="button-primary button-small"
                        href={`/editor/${site.id}`}
                      >
                        Edit
                      </Link>

                      {site.is_published && (
                        <a
                          className="button-secondary button-small"
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View live
                        </a>
                      )}

                      <button
                        type="button"
                        className="button-danger button-small"
                        onClick={() =>
                          void deleteSite(site)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>

      {showCreate && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={createSite}
          >
            <div className="modal-header">
              <h2>Create a website</h2>

              <button
                type="button"
                className="button-ghost"
                aria-label="Close"
                onClick={() =>
                  setShowCreate(false)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="field">
                <label htmlFor="site-name">
                  Website name
                </label>

                <input
                  id="site-name"
                  className="input"
                  value={siteName}
                  onChange={(event) =>
                    setSiteName(event.target.value)
                  }
                  placeholder="My new website"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  setShowCreate(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button-primary"
                disabled={creating}
              >
                {creating
                  ? 'Creating…'
                  : 'Create and edit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
