import { useAppStore } from '../store/useAppStore';
import { translations as id } from './translations/id';
import { translations as en } from './translations/en';

const langs = { id, en } as const;
export type Language = 'id' | 'en';
export type Translations = typeof id;

export function useTranslation() {
  const language = useAppStore((s) => s.language);
  return langs[language] as Translations;
}
