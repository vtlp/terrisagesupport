# Knowledge Base — In-folder rich-text documents + move files between folders

Two changes to the Files tab. The Articles tab is removed (replaced by inline documents).

## 1. Rich-text documents as files (admin authoring)

Admins can create a "document" that lives **inside a folder like any other file**, but its content is rich text written in-app instead of an uploaded binary.

- New **"New document"** button in the Files toolbar (admin only), next to Upload / New folder.
- Opens a dialog with a **Name** field and the existing **RichTextEditor**. Saves into the current folder.
- Stored as a normal `kb_files` row:
  - `mime_type = 'text/html'`
  - `storage_path = 'inline://<uuid>'` (sentinel — no Storage object)
  - HTML body lives in a new column `kb_files.content_html text`
- Shows in the folder grid with a document icon (lucide `FileText`).
- Click opens it inline (in `FilePreviewDialog`) rendering the HTML in a `prose` container, with a Copy-rich button (HTML + plain-text fallback, same `ClipboardItem` pattern already used).
- **Edit** (pencil icon, admin only) reopens the dialog pre-filled and runs `UPDATE kb_files SET name, content_html`.
- Rename / delete reuse the existing flows. Inline-doc delete just removes the row (no Storage cleanup needed).

## 2. Move files between folders (admin only)

- Add a **Move** action to each file row's action group (lucide `FolderInput` icon, admin only). Works for both uploaded files and inline docs.
- Opens a dialog with a folder picker (the same hierarchical tree shown in the sidebar, plus a "Root (no folder)" option). Current folder highlighted, can't be selected as destination.
- On confirm: `UPDATE kb_files SET folder_id = $1 WHERE id = $2`. Storage object is **not** moved (storage paths stay stable, signed URLs unaffected).
- Bulk move (multi-select) is **out of scope** for this round — single-file move only.
- Drag-and-drop move is **out of scope** for this round (folder drag-move already exists for folders; file DnD can come later).

## Role gating

| Action | Admin | Support agent |
|---|---|---|
| Browse, preview, download, copy | yes | yes |
| Upload files, create/delete folders | yes | yes (existing) |
| Create / edit inline documents | yes | no |
| Rename folders / files | yes | no |
| **Move files between folders** | yes | no |

## Technical changes

**Migration**
```sql
ALTER TABLE public.kb_files ADD COLUMN content_html text;
```
Existing RLS on `kb_files` covers it; no policy changes.

**Files to edit**
- `src/pages/Knowledge.tsx`
  - Remove the Articles tab and `kb_articles` UI; Files becomes the only view.
  - Add `showDocDialog`, `editingDocId`, `docForm { name, content_html }` state and `createDoc` / `updateDoc` handlers.
  - In file rows: detect `mime_type==='text/html'`, show document icon, route click to inline preview, show Edit (pencil) action for admins.
  - Add `moveTarget: { fileId } | null` state and a **MoveFileDialog** with a folder-tree picker; runs `UPDATE kb_files SET folder_id`.
  - Add "New document" button (admin-gated) to the Files toolbar.
- `src/components/shared/FilePreviewDialog.tsx`
  - Branch on `mime_type==='text/html'`: render `file.content_html` inside `prose` via `dangerouslySetInnerHTML`, skip the signed-URL fetch, expose Copy-rich.
- `src/integrations/supabase/types.ts` — auto-regenerated.

**Out of scope**
- Image uploads inside the rich text editor.
- Bulk multi-file move and drag-and-drop file move.
- Migrating any existing `kb_articles` rows into files (none in production use; if there are, say so and I'll add a one-time copy step).

Approve and I'll implement.
