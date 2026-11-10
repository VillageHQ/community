// The website widget: one script line the community pastes on its own site puts the public job board there, in a
// frame that the script sizes from the frame's "size_updated" message. No cookies and no tracking: the script only
// adds the frame and sets its height, and the frame reads no session.
//   <script src="https://<app>/api/job-board/widget.js" data-company="optional-company" async></script>

import { COMPANY_PARAM, JOB_BOARD_API_ROUTES, type PublicJob } from "./contract.ts";

// Runs on the community's own site. Inserts the frame after its own script tag.
export const WIDGET_SCRIPT = `(function () {
  var script = document.currentScript;
  if (!script || !script.src) return;
  var base = new URL(script.src).origin;
  var company = script.getAttribute("data-company");
  var frame = document.createElement("iframe");
  frame.src = base + "${JOB_BOARD_API_ROUTES.embed}" + (company ? "?${COMPANY_PARAM}=" + encodeURIComponent(company) : "");
  frame.title = script.getAttribute("data-title") || "Job board";
  frame.setAttribute("style", "display:block;width:100%;height:480px;border:0;background:transparent");
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("loading", "lazy");
  frame.setAttribute("referrerpolicy", "no-referrer");
  script.parentNode.insertBefore(frame, script.nextSibling);
  window.addEventListener("message", function (event) {
    if (event.origin !== base || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (data && data.type === "size_updated" && data.height > 0) frame.style.height = Math.ceil(data.height) + "px";
  });
})();
`;

// Runs inside the frame. Tells the page around it how tall the board is.
export const FRAME_SCRIPT = `(function () {
  if (window.parent === window) return;
  var last = 0;
  function post() {
    var board = document.getElementById("board");
    var height = board ? Math.ceil(board.getBoundingClientRect().height) : document.documentElement.scrollHeight;
    if (height && height !== last) {
      last = height;
      window.parent.postMessage({ type: "size_updated", height: height }, "*");
    }
  }
  window.addEventListener("load", post);
  window.addEventListener("resize", post);
  if (window.ResizeObserver) new ResizeObserver(post).observe(document.getElementById("board") || document.body);
  post();
})();
`;

// The only response any site may frame. Scripts come only from this app, and the frame reads and sets no cookies.
export const EMBED_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "frame-ancestors *",
].join("; ");

export const EMBED_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Security-Policy": EMBED_CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export const SCRIPT_HEADERS = {
  "Content-Type": "text/javascript; charset=utf-8",
  "Cache-Control": "public, max-age=300",
  "X-Content-Type-Options": "nosniff",
};

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

const EMBED_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; }
  body { font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2328; }
  #board { padding: 4px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  li { padding: 14px 16px; border-radius: 12px; background: #fff; box-shadow: inset 0 0 0 1.5px #e3e1dc; }
  a.job { font-weight: 700; color: inherit; text-decoration: none; }
  a.job:hover, a.job:focus-visible { text-decoration: underline; }
  .meta { margin: 2px 0 0; color: #5d6168; font-size: 14px; }
  .empty { margin: 0; padding: 16px; color: #5d6168; }
`;

function renderJob(job: PublicJob) {
  const meta = [job.company, job.location].filter(Boolean).map(escapeHtml).join(" · ");
  const title = escapeHtml(job.title);
  const heading = job.url ? `<a class="job" href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : `<span class="job">${title}</span>`;
  return `<li>${heading}<p class="meta">${meta}</p></li>`;
}

export function renderEmbedPage({ title, jobs }: { title: string; jobs: readonly PublicJob[] }) {
  const list = jobs.length > 0 ? `<ul>${jobs.map(renderJob).join("")}</ul>` : `<p class="empty">No open jobs right now.</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${EMBED_STYLES}</style>
</head>
<body>
<main id="board">${list}</main>
<script src="${JOB_BOARD_API_ROUTES.frameScript}"></script>
</body>
</html>
`;
}

// The two snippets for the admin page: the script line, and a plain frame for sites that block scripts.
export function readEmbedSnippets(appUrl: string, communityName: string) {
  const base = appUrl.replace(/\/$/, "");
  return {
    script: `<script src="${base}${JOB_BOARD_API_ROUTES.widgetScript}" async></script>`,
    companyScript: `<script src="${base}${JOB_BOARD_API_ROUTES.widgetScript}" data-company="company-name" async></script>`,
    frame: `<iframe src="${base}${JOB_BOARD_API_ROUTES.embed}" title="Jobs at ${escapeHtml(communityName)} companies" style="width:100%;height:900px;border:0" loading="lazy"></iframe>`,
  };
}
