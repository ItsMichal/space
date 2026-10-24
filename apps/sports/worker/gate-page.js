const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Same ink, paper and blue as halmic.com; system fonts, because the font files sit behind this very gate.
export function gatePage({ next = '/', error = '' } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark">
<title>halmic sports</title>
<style>
:root { --ink: #0f0e13; --ink-2: #181621; --line: #2c2938; --text: #f1ece1; --mute: #a29eae; --blue: #3d7bff; --blue-live: #7fa6ff; }
* { box-sizing: border-box; }
html { background: var(--ink); color-scheme: dark; }
body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px; color: var(--text); font: 400 17px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
main { width: 100%; max-width: 360px; }
h1 { margin: 0 0 4px; font: 900 40px/1 ui-rounded, "Arial Rounded MT Bold", ui-sans-serif, system-ui, sans-serif; letter-spacing: -.02em; }
h1 span { color: var(--blue-live); }
p { margin: 0 0 24px; color: var(--mute); }
form { display: grid; gap: 12px; }
input, button { font: inherit; min-height: 48px; border-radius: 999px; border: 1px solid var(--line); padding: 0 20px; }
input { background: var(--ink-2); color: var(--text); }
input::placeholder { color: var(--mute); }
button { background: var(--blue); border-color: var(--blue); color: #fff; font-weight: 700; cursor: pointer; }
button:hover { background: var(--blue-live); border-color: var(--blue-live); color: var(--ink); }
:focus-visible { outline: 2px solid var(--blue-live); outline-offset: 2px; }
.err { margin: 0 0 12px; color: #ff9a8a; }
</style>
</head>
<body>
<main>
<h1>halmic <span>sports</span></h1>
<p>Private test. Enter the passkey to continue.</p>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
<form method="post" action="/gate">
<input type="hidden" name="next" value="${esc(next)}">
<input type="password" name="passkey" placeholder="Passkey" autocomplete="current-password" autofocus required maxlength="256" aria-label="Passkey">
<button type="submit">Enter</button>
</form>
</main>
</body>
</html>
`;
}
