/**
 * Local mode: run GanttSmart on your own machine with a Linear personal API key,
 * without Supabase or a Linear OAuth app.
 *
 * Enabled when VITE_LINEAR_API_KEY is set AND the app is running under the Vite
 * dev server (`npm run dev`). It is never enabled in a production build, so the
 * key can't end up in a deployed bundle.
 *
 * What's unavailable in local mode (these need Supabase):
 * - Share links
 * - Plan vs Actual baselines and background change history
 */
const key = import.meta.env.DEV ? (import.meta.env.VITE_LINEAR_API_KEY as string | undefined) : undefined;

export const LOCAL_LINEAR_API_KEY: string = key?.trim() || '';

export const isLocalMode = LOCAL_LINEAR_API_KEY !== '';
