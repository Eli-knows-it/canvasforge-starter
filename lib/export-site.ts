import JSZip from 'jszip';

function safeFileName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'website';
}

export async function downloadSiteZip(name: string, html: string, css: string, javascript: string) {
  const zip = new JSZip();
  const finalHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Website created with CanvasForge" />
  <link rel="stylesheet" href="styles.css" />
  <title>${name.replace(/[<>]/g, '')}</title>
</head>
<body>
${html}
<script src="script.js" defer></script>
</body>
</html>`;

  zip.file('index.html', finalHtml);
  zip.file('styles.css', css);
  zip.file('script.js', javascript || '// Add your JavaScript here.');
  zip.file('README.txt', 'Upload index.html, styles.css, and script.js to any static web host.');

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(name)}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}
