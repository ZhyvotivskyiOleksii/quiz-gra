'use client';
import {useLocale} from 'next-intl';

export function useCurrentLocale() {
  return useLocale();
}
