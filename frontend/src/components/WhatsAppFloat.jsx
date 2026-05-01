export default function WhatsAppFloat() {
  const phone = import.meta.env.VITE_WHATSAPP_NUMBER || '+524427070872';
  const message = encodeURIComponent('¡Hola! Quiero más información sobre tus servicios inmobiliarios.');
  const link = `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${message}`;
  const iconSrc = `${import.meta.env.BASE_URL}whatsapp-icon.svg`;

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        aria-label="Contactar por WhatsApp"
        title="Contactar por WhatsApp"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.5)] transition duration-300 hover:scale-110 hover:bg-[#20ba5a] focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300 md:h-[4.5rem] md:w-[4.5rem]"
      >
        <img src={iconSrc} alt="WhatsApp" className="h-9 w-9 md:h-10 md:w-10" />
      </a>
    </div>
  );
}
