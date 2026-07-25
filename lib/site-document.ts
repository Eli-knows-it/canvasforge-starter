function escapeScript(source: string) {
  return source.replace(/<\/script/gi, '<\\/script');
}

export function buildPublishedDocument(input: {
  name: string;
  slug: string;
  html: string;
  css: string;
  javascript: string;
}) {
  const formBridge = `
(() => {
  const endpoint = '/api/forms/${encodeURIComponent(input.slug)}';
  document.querySelectorAll('form').forEach((form) => {
    if (form.dataset.canvasforgeBound === 'true') return;
    form.dataset.canvasforgeBound = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitter = form.querySelector('[type="submit"]');
      const status = form.querySelector('[data-canvasforge-status]') || document.createElement('p');
      if (!status.parentNode) {
        status.dataset.canvasforgeStatus = 'true';
        status.setAttribute('role', 'status');
        form.appendChild(status);
      }
      const originalText = submitter && 'textContent' in submitter ? submitter.textContent : '';
      if (submitter) submitter.disabled = true;
      if (submitter && 'textContent' in submitter) submitter.textContent = 'Sending…';
      status.textContent = '';
      try {
        const response = await fetch(endpoint, { method: 'POST', body: new FormData(form) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Unable to send the form.');
        status.textContent = result.message || 'Thanks! Your message was sent.';
        form.reset();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Unable to send the form.';
      } finally {
        if (submitter) submitter.disabled = false;
        if (submitter && 'textContent' in submitter) submitter.textContent = originalText;
      }
    });
  });
})();`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${input.name.replace(/[<>&"]/g, '')}</title>
<style>${input.css}</style>
</head>
<body>
${input.html}
<script>${escapeScript(input.javascript)}</script>
<script>${escapeScript(formBridge)}</script>
</body>
</html>`;
}
