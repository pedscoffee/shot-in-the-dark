marked.setOptions({
  gfm: false,
  breaks: true,
  headerIds: false,
  mangle: false
});

function sanitizeMarkdown(markdown) {
  return markdown
    .replace(/<script.*?>.*?<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

function renderMarkdown(markdown) {
  return marked.parse(sanitizeMarkdown(markdown));
}