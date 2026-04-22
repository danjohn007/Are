export default function WhatsAppFloat() {
  const phone = import.meta.env.VITE_WHATSAPP_NUMBER || '+5491155554444';
  const message = encodeURIComponent('¡Hola! Quiero más información sobre tus servicios inmobiliarios.');
  const link = `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${message}`;

  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-6 right-6 z-30 rounded-full bg-green-500 px-5 py-3 font-bold text-white shadow-lg transition hover:scale-105"
    >
      💬
    </a>
  );
}
