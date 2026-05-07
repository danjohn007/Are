import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import PublicLayout from './layouts/PublicLayout';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import PropertiesPage from './pages/PropertiesPage';
import DevelopmentsPage from './pages/DevelopmentsPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import NewsPage from './pages/NewsPage';
import BlogArticlePage from './pages/BlogArticlePage';
import ContactPage from './pages/ContactPage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  useEffect(() => {
    AOS.init({
      duration: 750,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      once: true,
      offset: 60,
      delay: 0,
    });
  }, []);

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:id" element={<ServiceDetailPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:id" element={<PropertyDetailPage />} />
        <Route path="/developments" element={<DevelopmentsPage />} />
        <Route path="/developments/:id" element={<PropertyDetailPage />} />
        <Route path="/blog" element={<NewsPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/blog/:slug" element={<BlogArticlePage />} />
        <Route path="/news/:slug" element={<BlogArticlePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/nosotros" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
