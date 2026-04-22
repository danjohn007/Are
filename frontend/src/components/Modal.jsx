export default function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded bg-gray-100 px-2 py-1 text-sm font-medium hover:bg-gray-200">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
