import JSZip from "jszip";

export interface ZipSection {
  title: string;
  rows: Array<{ label: string; value?: string }>;
}

export interface ZipFileGroup {
  /** Folder name inside the zip, e.g. "company-logo", "project-1-brochure" */
  folder: string;
  files: File[];
}

export interface BuildArgs {
  companyName: string;
  sections: ZipSection[];
  fileGroups: ZipFileGroup[];
}

// Module-level cache so the post-submit success screen can build a ZIP with the
// original File blobs (which can't survive a route change via router state).
let cachedSummary: BuildArgs | null = null;
export function stashOnboardingSummary(args: BuildArgs) {
  cachedSummary = args;
}
export function takeOnboardingSummary(): BuildArgs | null {
  return cachedSummary;
}

function buildSummaryText({ companyName, sections }: BuildArgs): string {
  const lines: string[] = [];
  lines.push(`Onboarding summary — ${companyName || "Untitled"}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  for (const section of sections) {
    lines.push("=".repeat(60));
    lines.push(section.title);
    lines.push("=".repeat(60));
    for (const row of section.rows) {
      const value = row.value && row.value.trim().length > 0 ? row.value : "—";
      lines.push(`${row.label}: ${value}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function safeSegment(name: string): string {
  return (name || "untitled").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}

export async function downloadOnboardingZip(args: BuildArgs): Promise<void> {
  const zip = new JSZip();
  zip.file("summary.txt", buildSummaryText(args));

  for (const group of args.fileGroups) {
    if (!group.files.length) continue;
    const folder = zip.folder(safeSegment(group.folder));
    if (!folder) continue;
    group.files.forEach((file) => {
      folder.file(file.name, file);
    });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `onboarding-${safeSegment(args.companyName) || "summary"}-${stamp}.zip`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
