import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · CampusOS`;
    return () => {
      document.title = 'CampusOS — one board for everything on campus';
    };
  }, [title]);
}
