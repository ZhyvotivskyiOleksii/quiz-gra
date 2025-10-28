import createMiddleware from 'next-intl/middleware';
import {locales, localePrefix} from './navigation';
 
export default createMiddleware({
  defaultLocale: 'pl',
  locales,
  localePrefix
});
 
export const config = {
  matcher: ['/', '/(de|pl)/:path*']
};