import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import WhatsAppFloat from '../components/WhatsAppFloat';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-isabelline text-arsenic">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
