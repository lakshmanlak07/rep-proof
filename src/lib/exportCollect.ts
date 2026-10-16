// "Download my data": everything RepProof stores for the signed-in user that the app can read, as one JSON file
// plus a CSV of every logged set. Reads go through row-level security, so only the caller's own rows can ever be
// included. What is left out, and why, is written into the file (exportTables.ts). Logic: exportCore.ts.
// Saving the files is platform-specific: exportData.ts (Android/iOS share sheet), exportData.web.ts (download).
import { collectExportWith, type ExportClient } from './exportCore';
import { supabase } from './supabase';

export const collectExport = (userId: string, email: string | null) => collectExportWith(supabase as unknown as ExportClient, userId, email);
