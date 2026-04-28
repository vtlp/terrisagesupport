# Knowledge Base — Admin authoring & rename

Add proper authoring tools to the Knowledge Base so admins can manage text templates and rename folders/files in place. All write actions are gated to admins (`isAdmin` from `UserContext`); support agents keep read-only access.

## What changes

### 1. Text templates (Articles tab) — admin authoring with rich text

The "New article" dialog already exists but uses a plain textarea, cannot edit existing entries, and isn't gated. Improvements:

- **Gate create/edit/delete to admins.** Hide the "New article" button and edit/delete actions for non-admins.
- **Rich text editor** for the article body, replacing the plain `Textarea`:
  - Use **TipTap** (`@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link`), which is the standard React-friendly rich text editor and works well with Tailwind. Lightweight, no external service.
  - Toolbar with: bold, italic, underline, strikethrough, H1/H2/H3, bulleted list, numbered list, blockquote, code block, link (add/remove), and clear-formatting.
  - Stores the body as **HTML** in `kb_articles.body` (existing `text` column, no migration).
  - Article detail view renders the HTML safely with a `prose` Tailwind class for nice typography, replacing the current `whitespace-pre-wrap` block.
  - "Copy" button copies both rich HTML and a plain-text fallback to the clipboard (using `ClipboardItem` with `text/html` + `text/plain`) so pasting into Gmail/WhatsApp Web preserves formatting.
  - Build a small reusable `RichTextEditor` component at `src/components/shared/RichTextEditor.tsx` so it can be reused later (e.g. ticket replies, notes).
- **Edit existing template.** Add an "Edit" button on the selected article view that reopens the same dialog pre-filled (title, bucket, body, tags). Saving runs an `UPDATE` on `kb_articles`.
- **Delete template.** Add a "Delete" button next to Edit, with a confirm prompt.
- **Reuse one dialog** for both create and edit (track `editingArticleId`); keep the existing fields and tag-CSV input.

### 2. Rename folders (Files tab) — admin only

- Add a **rename action** (pencil icon) on each folder row in the sidebar tree, visible on hover next to the existing "new subfolder" button. Admin-only.
- Also expose rename from each folder card in the main grid (small icon button).
- Opens a small dialog with the current name pre-filled. On save:
  - Validate non-empty and trim.
  - Reject if a sibling folder under the same parent already has that name (case-insensitive), matching the existing move-folder rule.
  - `UPDATE kb_folders SET name = $1 WHERE id = $2`, then reload.
- The underlying storage paths use folder IDs (`${folderId}/...`), so renaming the folder does **not** require touching Storage. Safe.

### 3. Rename files (Files tab) — admin only

- Add a **rename action** (pencil icon) in the file row action group, between Preview/Download and Delete. Admin-only.
- Opens a dialog with the current filename pre-filled (extension included, editable).
- On save:
  - Validate non-empty.
  - `UPDATE kb_files SET name = $1 WHERE id = $2`. The display name changes immediately.
  - The Storage object is **not moved** (storage path stays the same to avoid signed-URL churn and copy/delete risk). Downloads already pass `{ download: f.name }` to `createSignedUrl`, so the downloaded file uses the new name automatically. Preview uses `name` for display too.

### 4. Role gating summary

| Action | Admin | Support agent |
|---|---|---|
| Browse folders, preview, download | yes | yes |
| Create/upload/delete files & folders | yes | yes (existing behaviour kept) |
| Rename folders | yes | no |
| Rename files | yes | no |
| Create / edit / delete articles | yes | no |

## Files to add / edit

- **New:** `src/components/shared/RichTextEditor.tsx` — TipTap-based editor with toolbar, controlled `value` (HTML string) + `onChange`.
- **Edit:** `src/pages/Knowledge.tsx` — add:
  - `isAdmin` from `useUser()`
  - `editingArticleId` state and reuse of the article dialog for create + edit
  - Swap article-body `Textarea` for `<RichTextEditor>`
  - Render selected article body as HTML inside `prose` container
  - Rich-aware Copy (HTML + plain-text fallback)
  - `updateArticle` and `deleteArticle` handlers
  - `renameFolder(folderId, newName)` handler with sibling-name guard
  - `renameFile(fileId, newName)` handler
  - Rename dialog state (`renameTarget: { kind: 'folder'|'file', id, name } | null`)
  - Pencil icon buttons (lucide `Pencil`) on folder rows, folder cards, file rows
  - Edit/Delete buttons in the article detail view

## Dependencies

Add `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-underline`. Tailwind `@tailwindcss/typography` is already commonly available; if not present I will add it for the `prose` class used in article rendering.

No DB schema changes, no edge function changes, no migration needed. RLS already permits staff full access on `kb_folders`, `kb_files`, and `kb_articles`; the admin restriction is a UI gate.

## Out of scope

- Image uploads inside the rich text editor (can be added later via a Storage-backed image extension).
- Moving files between folders via UI (folder drag-move already exists for folders).
- Renaming the underlying Storage object (not needed for correct UX).
