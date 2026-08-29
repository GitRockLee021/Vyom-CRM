import { useNavigate } from 'react-router-dom';

const ROUTE_BY_LABEL = {
  dashboard: '/',
  clients: '/clients',
  invoices: '/invoices',
  billing: '/invoices',
  settings: '/settings',
  'company information': '/settings',
  'company details': '/settings',
  'team members': '/settings/team',
  'roles & permissions': '/settings/roles',
};

export function useMockNav() {
  const navigate = useNavigate();

  return (event) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    const clone = anchor.cloneNode(true);
    clone.querySelectorAll('.material-symbols-outlined').forEach((el) => el.remove());
    const label = clone.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    const to = ROUTE_BY_LABEL[label];
    if (to) {
      event.preventDefault();
      navigate(to);
    }
  };
}
