import { useEffect, useState } from 'react';

function parse() {
  const [page = '', section = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { page, section };
}

// Hash routes: #/page/section. Kept from the vanilla app so links and bookmarks still work.
export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(hash) {
  if (location.hash !== hash) location.hash = hash;
}
