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

type CreateMode = 'blank' | 'url' | null;

type ImportedPage = {
  title?: string;
  sourceUrl: string;
  html: string;
  css: string;
  javascript: string;
  importedAssets?: number;
  error?: string;
};

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
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importMessage, setImportMessage] = useState('');
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

  function openCreate() {
    setShowCreate(true);
    setCreateMode(null);
    setSiteName('');
    setImportUrl('');
    setImportMessage('');
    setError('');
  }

  function closeCreate() {
    if (creating) return;
    setShowCreate(false);
    setCreateMode(null);
    setSiteName('');
    setImportUrl('');
    setImportMessage('');
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

  async function importWebsite(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanUrl = importUrl.trim();

    if (!cleanUrl) {
      setError('Paste the website URL you want to import.');
      return;
    }

    setCreating(true);
    setError('');
    setImportMessage(
      'Reading the website and copying its layout, styles, and images…'
    );

    try {
      const supabase = getSupabase();
      const { data: sessionData } =
        await supabase.auth.getSession();

      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error(
          'Your session has expired. Please sign in again.'
        );
      }

      const response = await fetch('/api/import-url', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: cleanUrl })
      });

      const imported =
        (await response.json()) as ImportedPage;

      if (!response.ok) {
        throw new Error(
          imported.error ||
            'CanvasForge could not import that website.'
        );
      }

      setImportMessage(
        `Imported the page and copied ${imported.importedAssets || 0} assets. Creating the editable site…`
      );

      const inferredName = (() => {
        if (siteName.trim()) return siteName.trim();
        if (imported.title?.trim()) return imported.title.trim();

        try {
          return new URL(imported.sourceUrl || cleanUrl)
            .hostname.replace(/^www\./, '')
            .split('.')[0]
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (letter) =>
              letter.toUpperCase()
            );
        } catch {
          return 'Imported website';
        }
      })();

      const { data: authData } =
        await supabase.auth.getUser();

      if (!authData.user) {
        throw new Error(
          'Your session has expired. Please sign in again.'
        );
      }

      const slug =
        `${makeSlug(inferredName)}-` +
        crypto.randomUUID().slice(0, 6);

      const { data, error: insertError } =
        await supabase
          .from('sites')
          .insert({
            owner_id: authData.user.id,
            name: inferredName.slice(0, 80),
            slug,
            html: imported.html,
            css: imported.css,
            javascript: imported.javascript,
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

      closeCreate();
      router.push(`/editor/${data.id}`);
    } catch (caught) {
      setImportMessage('');
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to import website.'
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
            onClick={openCreate}
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
            onClick={openCreate}
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
                onClick={openCreate}
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
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-site-title"
          >
            <div className="modal-header">
              <h2 id="create-site-title">
                Create a website
              </h2>

              <button
                type="button"
                className="button-ghost"
                aria-label="Close"
                onClick={closeCreate}
                disabled={creating}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {!createMode && (
                <div
                  style={{
                    display: 'grid',
                    gap: 14
                  }}
                >
                  <button
                    type="button"
                    className="button-secondary"
                    style={{
                      textAlign: 'left',
                      padding: 20
                    }}
                    onClick={() =>
                      setCreateMode('blank')
                    }
                  >
                    <strong
                      style={{
                        display: 'block',
                        fontSize: '1.05rem',
                        marginBottom: 5
                      }}
                    >
                      Start from scratch
                    </strong>
                    <span>
                      Create a fresh CanvasForge
                      website and build it visually.
                    </span>
                  </button>

                  <button
                    type="button"
                    className="button-secondary"
                    style={{
                      textAlign: 'left',
                      padding: 20
                    }}
                    onClick={() =>
                      setCreateMode('url')
                    }
                  >
                    <strong
                      style={{
                        display: 'block',
                        fontSize: '1.05rem',
                        marginBottom: 5
                      }}
                    >
                      Import from URL
                    </strong>
                    <span>
                      Copy a page you own into
                      CanvasForge and make it editable.
                    </span>
                  </button>
                </div>
              )}

              {createMode === 'blank' && (
                <form
                  id="create-blank-site"
                  onSubmit={createSite}
                >
                  <div className="field">
                    <label htmlFor="site-name">
                      Website name
                    </label>

                    <input
                      id="site-name"
                      className="input"
                      value={siteName}
                      onChange={(event) =>
                        setSiteName(
                          event.target.value
                        )
                      }
                      placeholder="My new website"
                      required
                      autoFocus
                    />
                  </div>
                </form>
              )}

              {createMode === 'url' && (
                <form
                  id="import-url-site"
                  onSubmit={importWebsite}
                >
                  <div className="field">
                    <label htmlFor="import-url">
                      Website URL
                    </label>

                    <input
                      id="import-url"
                      className="input"
                      type="url"
                      value={importUrl}
                      onChange={(event) =>
                        setImportUrl(
                          event.target.value
                        )
                      }
                      placeholder="https://yourwebsite.com"
                      required
                      autoFocus
                    />
                  </div>

                  <div
                    className="field"
                    style={{ marginTop: 14 }}
                  >
                    <label htmlFor="import-name">
                      CanvasForge website name
                      {' '}
                      <span
                        style={{
                          fontWeight: 400
                        }}
                      >
                        (optional)
                      </span>
                    </label>

                    <input
                      id="import-name"
                      className="input"
                      value={siteName}
                      onChange={(event) =>
                        setSiteName(
                          event.target.value
                        )
                      }
                      placeholder="Uses the page title if blank"
                    />
                  </div>

                  <p
                    style={{
                      margin: '14px 0 0',
                      lineHeight: 1.5,
                      opacity: 0.72,
                      fontSize: '.9rem'
                    }}
                  >
                    Use this for pages you own or
                    have permission to reproduce.
                    Complex web apps may need some
                    manual cleanup after import.
                  </p>

                  {importMessage && (
                    <p
                      style={{
                        marginTop: 14,
                        fontWeight: 700
                      }}
                    >
                      {importMessage}
                    </p>
                  )}
                </form>
              )}

              {error && (
                <div
                  className="message-error"
                  role="alert"
                  style={{ marginTop: 16 }}
                >
                  {error}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {createMode ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    if (creating) return;
                    setCreateMode(null);
                    setError('');
                    setImportMessage('');
                  }}
                  disabled={creating}
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={closeCreate}
                  disabled={creating}
                >
                  Cancel
                </button>
              )}

              {createMode === 'blank' && (
                <button
                  type="submit"
                  form="create-blank-site"
                  className="button-primary"
                  disabled={creating}
                >
                  {creating
                    ? 'Creating…'
                    : 'Create and edit'}
                </button>
              )}

              {createMode === 'url' && (
                <button
                  type="submit"
                  form="import-url-site"
                  className="button-primary"
                  disabled={creating}
                >
                  {creating
                    ? 'Importing…'
                    : 'Import and edit'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
