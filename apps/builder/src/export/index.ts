/**
 * Public entry for the Export pipeline (Task 7).
 *
 * Usage:
 *   const template = await fetchTemplate();
 *   const html = buildOverlayHtml({ project, templateHtml: template });
 *   downloadOverlayHtml(html, `${safeFilename(project.meta.name)}.overlay.html`);
 */
export { buildOverlayHtml, downloadOverlayHtml, safeFilename } from "./export";
export type { ExportOptions } from "./export";
export { fetchTemplate, clearTemplateCache } from "./template";
