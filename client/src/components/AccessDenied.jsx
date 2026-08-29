export default function AccessDenied({ message = "You don't have permission to access this page." }) {
  return (
    <div className="bg-surface font-body-md text-on-surface h-screen flex items-center justify-center">
      <div className="text-center space-y-2 px-4">
        <div className="material-symbols-outlined text-4xl text-on-surface-variant mx-auto">lock</div>
        <p className="font-body-lg text-body-lg text-on-surface">{message}</p>
      </div>
    </div>
  );
}