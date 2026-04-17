export type PdfSolutionFontPref = "auto" | "10" | "9" | "8";

export interface UserPreferences {
  pdfSolutionFont?: PdfSolutionFontPref;
  defaultTemplateKey?: string;
  palette?: string;
  reduceMotion?: boolean;
  // Jira custom fields mapping (names or IDs, e.g., customfield_12345)
  jiraAddressField?: string;
  jiraCityField?: string;
  jiraStateField?: string;
  jiraStoreField?: string;
  jiraPdvField?: string;
  subirAoJira?: boolean;
}

const PREFS_KEY = "wt_user_preferences_v1";

export function loadPreferences(): UserPreferences {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(PREFS_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UserPreferences;
    return parsed || {};
  } catch {
    return {};
  }
}

export function savePreferences(next: UserPreferences) {
  try {
    const current = loadPreferences();
    const merged = { ...current, ...next } as UserPreferences;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return next;
  }
}


