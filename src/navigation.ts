import {createNavigation} from 'next-intl/navigation';
 
export const locales = ['pl', 'de'] as const;
export const localePrefix = 'always'; // Default

export const pathnames = {
  '/': '/',
  '/login': '/login',
  '/register': '/register',
  '/admin': '/admin',
  '/admin/questions': '/admin/questions',
  '/admin/questions/generate': '/admin/questions/generate',
  '/admin/settlements': '/admin/settlements',
  '/admin/users': '/admin/users',
  '/admin/logs': '/admin/logs',
  '/admin/settings': '/admin/settings',
  '/app': '/app',
  '/app/history': '/app/history',
  '/app/profile': '/app/profile',
} as const;
 
export const {Link, redirect, usePathname, useRouter} =
  createNavigation({locales, localePrefix, pathnames});
