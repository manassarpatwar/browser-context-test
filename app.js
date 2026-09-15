'use strict';
const samples = [];
let settled = null;
let baseline = null;
function readBaseline() {
try {
  baseline = new URLSearchParams(location.hash.slice(1)).get('baseline');
  if (baseline && !/^[a-f0-9]{64}$/.test(baseline)) baseline = null;
} catch { /* An invalid fragment does not prevent sampling. */ }
}
readBaseline();
window.addEventListener('hashchange', () => { readBaseline(); render(); });

function inputs() {
  const v = window.visualViewport;
  return {
    userAgent: navigator.userAgent,
    inner: [innerWidth, innerHeight],
    outer: [outerWidth, outerHeight],
    screen: [screen.width, screen.height],
    availableScreen: [screen.availWidth, screen.availHeight],
    devicePixelRatio,
    visualViewport: v ? [v.width, v.height, v.scale] : null
  };
}

async function capture(event) {
  const sample = { event, ms: Math.round(performance.now()), inputs: inputs(), hash: null };
  samples.push(sample);
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sample.inputs)));
    sample.hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    sample.error = String(error);
  }
  if (event === 'Load + 3000ms') settled = sample;
  render();
}

function report() {
  return {
    context: self === top ? 'Top-level page' : 'IFRAME',
    referrer: document.referrer,
    baseline,
    settledHash: settled?.hash ?? null,
    matchesBaseline: baseline && settled?.hash ? baseline === settled.hash : null,
    samples
  };
}

function render() {
  const output = document.getElementById('output');
  if (!output) return;
  document.getElementById('context').textContent = self === top
    ? 'Top-level page ✓' : 'IFRAME — open this URL directly for a top-level measurement.';
  output.textContent = JSON.stringify(report(), null, 2);
  if (settled) {
    document.getElementById('hash').textContent = settled.hash ?? 'Hash failed';
    document.getElementById('link').disabled = !settled.hash;
    document.getElementById('status').textContent = 'Three-second sample captured.';
    document.getElementById('comparison').textContent = baseline && settled.hash
      ? (baseline === settled.hash ? 'MATCH — same measured inputs.' : 'DIFFERENT — measured inputs changed.')
      : 'No baseline supplied. Copy a comparison link to compare another browser.';
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById('status').textContent = 'Copied.';
  } catch {
    const field = document.getElementById('fallback');
    field.hidden = false;
    field.value = text;
    field.focus();
    field.select();
    document.getElementById('status').textContent = 'Select and copy the text below.';
  }
}

capture('Early script');
document.addEventListener('DOMContentLoaded', () => {
  capture('DOMContentLoaded');
  document.getElementById('sample').onclick = () => capture('Manual');
  document.getElementById('copy').onclick = () => copyText(JSON.stringify(report(), null, 2));
  document.getElementById('link').onclick = () => {
    const url = new URL(location.href);
    url.hash = new URLSearchParams({ baseline: settled.hash }).toString();
    copyText(url.href);
  };
});
window.addEventListener('load', () => {
  capture('Window load');
  [100, 500, 1500, 3000].forEach(ms => setTimeout(() => capture(`Load + ${ms}ms`), ms));
});
window.addEventListener('resize', () => capture('Window resize'));
window.visualViewport?.addEventListener('resize', () => capture('Visual viewport resize'));
