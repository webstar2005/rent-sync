/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
        renderButton: (element: Element | null, options: Record<string, unknown>) => void;
      };
    };
  };
}
