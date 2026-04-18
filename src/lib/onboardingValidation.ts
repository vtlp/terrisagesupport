// File validation helpers
export const LOGO_FORMATS = ["image/png", "image/jpeg", "image/svg+xml"];
export const BROCHURE_FORMATS = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"];
export const IMPORT_FILE_FORMATS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
];
export const IMAGE_FORMATS = ["image/jpeg", "image/png"];

export const LOGO_EXTENSIONS = "PNG, JPG, SVG";
export const BROCHURE_EXTENSIONS = "PDF, DOC, DOCX, JPG, PNG";
export const IMPORT_EXTENSIONS = "PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG";
export const IMAGE_EXTENSIONS = "JPG, PNG";

// Max upload size for bulk import files (bytes). 100 MB.
export const BULK_IMPORT_MAX_BYTES = 100 * 1024 * 1024;
