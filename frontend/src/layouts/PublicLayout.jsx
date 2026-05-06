import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import WhatsAppFloat from '../components/WhatsAppFloat';

export default function PublicLayout() {
  const location = useLocation();
  const mainRef = useRef(null);

  // Fade-in transition on route change
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.classList.remove('page-entered');
    // Force reflow so the class removal is applied before re-adding
    void el.offsetHeight;
    el.classList.add('page-entered');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-isabelline text-arsenic">
      <Navbar />
      <main ref={mainRef} className="page-enter">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
