'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { defaultCss, defaultHtml } from '@/lib/default-site';
import { getSupabase } from '@/lib/supabase';
import type { Site } from '@/lib/types';

function makeSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 54) || 'new-site';
}

export function DashboardClient() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadSites();
  }, []);

  async function loadSites() {
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace('/login');
        return;
      }
      const { data, error: fetchError } = await supabase
        .from('sites')
        .select('*')
        .order('updated_at', { ascending: false });
      if (fetchError) throw fetchError;
      setSites((data ?? []) as Site[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load websites.');
    } finally {
      setLoading(false);
    }
  }

  async function createSite(event: FormEvent) {
    event.preventDefault();
    if (!siteName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('Your session has expired.');

      const baseSlug = makeSlug(siteName);
      const uniqueSlug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
      const { data, error: insertError } = await supabase
        .from('sites')
        .insert({
          owner_id: authData.user.id,
          name: siteName.trim(),
          slug: uniqueSlug,
          html: defaultHtml,
          css: defaultCss,
          javascript: '',
          project_data: null
        })
        .select('*')
        .single();
      if (insertError) throw insertError;
      setShowCreate(false);
      setSiteName('');
      router.push(`/editor/${data.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create website.');
    } finally {
      setCreating(false);
    }
  }

  async function deleteSite(site: Site) {
    const accepted = window.confirm(`Delete “${site.name}”? This cannot be undone.`);
    if (!accepted) return;
    try {
      const supabase = getSupabase();
      const { error: deleteError } = await supabase.from('sites').delete().eq('id', site.id);
      if (deleteError) throw deleteError;
      setSites((current) => current.filter((item) => item.id !== site.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete website.');
    }
  }

  async function signOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return <div className="loading-screen"><div><div className="spinner"/><p>Loading your websites…</p></div></div>;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/dashboard" className="logo"><span className="logo-mark">C</span>CanvasForge</Link>
        <div className="nav-actions">
          <button className="button-secondary button-small" onClick={() => setShowCreate(true)}>+ New website</button>
          <button className="button-ghost button-small" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="page">
        <div className="page-heading">
          <div>
            <h1>Your websites</h1>
            <p>Import AI-generated code, visually edit it, autosave, preview, and export.</p>
          </div>
          <button className="button-primary" onClick={() => setShowCreate(true)}>Create website</button>
        </div>
        {error && <div className="message-error" style={{ marginBottom: 18 }}>{error}</div>}
        <section className="site-grid">
          {sites.length === 0 ? (
            <div className="empty-state">
              <div className="logo-mark" style={{ margin: 'auto' }}>+</div>
              <h2>Create your first website</h2>
              <p>Start with a template or paste a complete HTML, CSS, and JavaScript site.</p>
              <button className="button-primary" onClick={() => setShowCreate(true)}>Create website</button>
            </div>
          ) : sites.map((site) => (
            <article className="site-card" key={site.id}>
              <div className="site-preview">
                <div className="site-preview-inner">
                  <div className="mini-line bold"/>
                  <div className="mini-line" style={{ width: '90%' }}/>
                  <div className="mini-line" style={{ width: '66%' }}/>
                </div>
              </div>
              <div className="site-card-body">
                <div className="site-title-row"><h2 className="site-title">{site.name}</h2></div>
                <p className="site-meta">Updated {new Date(site.updated_at).toLocaleString()}</p>
                <div className="site-actions">
                  <Link className="button-primary button-small" href={`/editor/${site.id}`}>Edit</Link>
                  <button className="button-danger button-small" onClick={() => deleteSite(site)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>

      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal" style={{ maxWidth: 500 }} onSubmit={createSite}>
            <div className="modal-header"><h2>Create a website</h2><button type="button" className="button-ghost" onClick={() => setShowCreate(false)}>✕</button></div>
            <div className="modal-body">
              <div className="field">
                <label htmlFor="site-name">Website name</label>
                <input id="site-name" className="input" value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="My business website" autoFocus required maxLength={80}/>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="button-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="button-primary" disabled={creating}>{creating ? 'Creating…' : 'Create and edit'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
