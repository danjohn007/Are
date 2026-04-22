import { useEffect, useState } from 'react';
import api from '../services/api';
import ServiceCard from '../components/ServiceCard';
import Modal from '../components/Modal';
import DynamicLeadForm from '../components/DynamicLeadForm';

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const response = await api.get('/services?limit=30&page=1');
      setServices(response.data.data);
    }
    fetchData();
  }, []);

  return (
    <section className="section-shell py-14">
      <div className="mb-10 text-center">
        <h2 className="font-heading text-4xl font-black text-slate-950">Servicios Inmobiliarios</h2>
        <p className="mt-2 text-gray-600">Servicios profesionales especializados con formularios dinámicos y respuesta inmediata a tus necesidades.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onSelect={(item) => {
              setSelected(item);
              setOpen(true);
            }}
          />
        ))}
      </div>

      <Modal open={open} title={`Solicitud: ${selected?.name || ''}`} onClose={() => setOpen(false)}>
        <DynamicLeadForm
          service={selected}
          onSuccess={() => {
            setOpen(false);
            alert('Tu solicitud ha sido enviada exitosamente.');
          }}
        />
      </Modal>
    </section>
  );
}
