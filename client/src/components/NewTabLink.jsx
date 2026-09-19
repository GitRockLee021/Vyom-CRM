import { useAuth, handoffSession } from '../context/AuthContext.jsx';

export default function NewTabLink({ href, className, title, children }) {
  const { token, user } = useAuth();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={title}
      onClick={() => handoffSession(token, user)}
    >
      {children}
    </a>
  );
}