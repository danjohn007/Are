-- ─── Usuario administrador ────────────────────────────────────────────────────
-- Contraseña: Admin123!
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Administrador ARE',
  'admin@portal.com',
  '$2y$10$xAvTSMEmqR/u/MHJvYfIj.fJRh88JHZwve23cwWpzKOgvwgSSzkp2',
  'admin'
)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ─── Servicios ────────────────────────────────────────────────────────────────
INSERT INTO services (name, slug, description, price, form_schema) VALUES
(
  'Avalúo de Inmuebles',
  'avaluo-inmuebles',
  'Valuación profesional de propiedades residenciales y comerciales con dictamen técnico certificado.',
  3500.00,
  '{"fields":[{"name":"nombre","label":"Nombre completo","type":"text","required":true},{"name":"tipoInmueble","label":"Tipo de inmueble","type":"select","options":["Casa","Departamento","Local comercial","Terreno","Oficina"],"required":true},{"name":"municipio","label":"Municipio o alcaldía","type":"text","required":true}]}'
),
(
  'Asesoría Legal Inmobiliaria',
  'asesoria-legal',
  'Acompañamiento legal en compraventa, escrituración, contratos de arrendamiento y regularización de predios.',
  2200.00,
  '{"fields":[{"name":"nombre","label":"Nombre completo","type":"text","required":true},{"name":"tipoCaso","label":"Tipo de caso","type":"select","options":["Compraventa","Arrendamiento","Sucesión","Regularización","Otro"],"required":true}]}'
),
(
  'Consultoría de Crédito Hipotecario',
  'credito-hipotecario',
  'Te orientamos para obtener el mejor crédito hipotecario según tu perfil financiero. Evaluamos Infonavit, Fovissste y banca privada.',
  1800.00,
  '{"fields":[{"name":"nombre","label":"Nombre completo","type":"text","required":true},{"name":"ingresos","label":"Ingresos mensuales aproximados","type":"select","options":["Menos de $10,000","$10,000 - $25,000","$25,000 - $50,000","Más de $50,000"],"required":true},{"name":"credito","label":"Tipo de crédito de interés","type":"select","options":["Infonavit","Fovissste","Banca privada","No sé aún"],"required":false}]}'
),
(
  'Administración de Propiedades',
  'administracion-propiedades',
  'Nos encargamos de todo: inquilinos, cobro de rentas, mantenimiento y reportes mensuales. Despreocúpate de tu inversión.',
  1500.00,
  '{"fields":[{"name":"nombre","label":"Nombre del propietario","type":"text","required":true},{"name":"numPropiedades","label":"Número de propiedades","type":"select","options":["1","2 - 5","6 o más"],"required":true}]}'
),
(
  'Home Staging y Fotografía',
  'home-staging',
  'Preparamos tu propiedad para destacar en el mercado: decoración, limpieza profunda y sesión fotográfica profesional.',
  4500.00,
  '{"fields":[{"name":"nombre","label":"Nombre completo","type":"text","required":true},{"name":"metrosCuadrados","label":"Metros cuadrados aproximados","type":"text","required":true}]}'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price = VALUES(price),
  form_schema = VALUES(form_schema);

-- ─── Propiedades ──────────────────────────────────────────────────────────────
INSERT INTO properties (title, description, price, address, city, bedrooms, bathrooms, area, image_url, operation_type) VALUES
(
  'Casa en venta — Colonia Del Valle',
  'Hermosa casa de 3 recámaras en una de las colonias más exclusivas de la CDMX. Cocina equipada, jardín privado, 2 lugares de estacionamiento y seguridad 24/7.',
  6500000.00,
  'Av. Del Valle 345, Col. Del Valle',
  'Ciudad de México',
  3, 2, 180.00,
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
  'venta'
),
(
  'Departamento en renta — Polanco',
  'Moderno departamento amueblado de 2 recámaras con vista panorámica al parque. Edificio con gym, roof garden y concierge. Ideal para ejecutivos.',
  25000.00,
  'Emilio Castelar 120, Polanco',
  'Ciudad de México',
  2, 2, 95.00,
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
  'renta'
),
(
  'Casa en venta — Zona Esmeralda',
  'Residencia de lujo con alberca, jardín amplio y acabados de primera. Zona tranquila con acceso controlado. 4 recámaras, sala de cine y bodega.',
  12800000.00,
  'Blvd. Esmeralda 780, Fraccionamiento Los Cedros',
  'Atizapán de Zaragoza',
  4, 3, 320.00,
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800',
  'venta'
),
(
  'Departamento en venta — Satélite',
  'Departamento de 3 recámaras en Torre Satélite con acabados modernos. Seguridad, área de juegos y estacionamiento subterráneo. Excelente plusvalía.',
  3200000.00,
  'Circuito Circunvalación Pte. 10, Ciudad Satélite',
  'Naucalpan',
  3, 2, 120.00,
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
  'venta'
),
(
  'Local comercial en renta — Roma Norte',
  'Amplio local en planta baja con gran visibilidad. Ideal para restaurante, cafetería o boutique. 80 m² con baño y bodega incluida.',
  28000.00,
  'Álvaro Obregón 213, Roma Norte',
  'Ciudad de México',
  0, 1, 80.00,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  'renta'
),
(
  'Casa en renta — San Pedro Garza García',
  'Elegante casa en privada con 3 recámaras, estudio, alberca y jardín. Mínimo 12 meses. Zona premium con fácil acceso a San Pedro y Monterrey.',
  32000.00,
  'Privada Las Palmas 15, San Pedro Garza García',
  'Monterrey',
  3, 3, 250.00,
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
  'renta'
),
(
  'Terreno en venta — Querétaro',
  'Terreno de uso mixto en zona de alto crecimiento. Ideal para desarrollo de condominios o plaza comercial. Todos los servicios. Acceso a vía rápida.',
  5400000.00,
  'Boulevard Bernardo Quintana, El Marqués',
  'Querétaro',
  0, 0, 1200.00,
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
  'venta'
),
(
  'Penthouse en venta — Santa Fe',
  'Espectacular penthouse de 220 m² con terraza privada y jacuzzi exterior. Doble altura, cocina gourmet y 3 cajones de estacionamiento. Vista inmejorable.',
  18500000.00,
  'Av. Javier Barros Sierra 540, Santa Fe',
  'Ciudad de México',
  3, 3, 220.00,
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
  'venta'
);

-- ─── Artículos ────────────────────────────────────────────────────────────────
INSERT INTO articles (title, slug, excerpt, content, image_url, published) VALUES
(
  '¿Cómo preparar tu propiedad para vender más rápido?',
  'preparar-propiedad-para-vender',
  'Pequeñas mejoras pueden aumentar el valor de tu propiedad hasta un 15%. Descubre los tips clave.',
  'Preparar tu propiedad antes de ponerla en venta hace una gran diferencia. Asegúrate de realizar reparaciones menores, pintar en colores neutros, ordenar y limpiar profundamente cada espacio. La primera impresión es decisiva. Contrata un servicio de fotografía profesional y considera el home staging para que los compradores se imaginen viviendo ahí. Recuerda que una propiedad bien presentada se vende hasta un 30% más rápido y a mejor precio.',
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
  TRUE
),
(
  'Tendencias del mercado inmobiliario en México 2026',
  'tendencias-inmobiliarias-2026',
  'El mercado inmobiliario mexicano sigue creciendo. Analizamos las zonas con mayor plusvalía este año.',
  'El mercado inmobiliario en México mantiene un crecimiento sostenido. Las ciudades con mayor plusvalía en 2026 son Querétaro, Mérida, Monterrey y la Zona Metropolitana de la CDMX. Los desarrollos mixtos y las comunidades cerradas son las tipologías más demandadas. La tecnología también juega un papel importante: los tours virtuales y las firmas digitales están transformando la manera en que se compran y venden propiedades.',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800',
  TRUE
),
(
  'Guía completa para rentar tu primera propiedad',
  'guia-rentar-primera-propiedad',
  'Todo lo que necesitas saber antes de firmar un contrato de arrendamiento en México.',
  'Rentar una propiedad en México implica conocer tus derechos y obligaciones. El contrato de arrendamiento debe especificar el monto de renta, el periodo, las condiciones de depósito y las causas de rescisión. Verifica que el inmueble esté en buen estado, solicita recibos de agua, luz y predial pagados. Es recomendable contar con un aval o póliza jurídica. Si necesitas asesoría, en ARE te acompañamos durante todo el proceso.',
  'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800',
  TRUE
),
(
  'Inversión inmobiliaria: ¿Casa o departamento?',
  'inversion-casa-o-departamento',
  'Compara las ventajas de invertir en casa versus departamento y toma la mejor decisión para tu patrimonio.',
  'Al momento de invertir en bienes raíces, la pregunta frecuente es: ¿casa o departamento? Las casas ofrecen mayor espacio, privacidad y posibilidad de remodelación, pero requieren más mantenimiento. Los departamentos son más accesibles, tienen mejor ubicación urbana y costos de mantenimiento compartidos. La clave está en analizar tu presupuesto, el uso que le darás (habitación o inversión) y la zona. En ARE te ayudamos a comparar opciones y encontrar la mejor alternativa para ti.',
  'https://images.unsplash.com/photo-1575517111839-3a3843ee7f5d?w=800',
  TRUE
),
(
  'Crédito hipotecario: pasos para obtener el mejor financiamiento',
  'como-obtener-credito-hipotecario',
  'Aprende a comparar tasas, plazos y condiciones para sacar el mayor provecho de tu crédito.',
  'Obtener un crédito hipotecario es una de las decisiones financieras más importantes. Antes de solicitarlo, revisa tu historial crediticio, calcula tu capacidad de pago y compara las opciones: Infonavit, Fovissste, cofinavit y banca privada. Los factores clave son la tasa de interés (fija vs. variable), el plazo, el CAT y los gastos de apertura. Un asesor inmobiliario puede ayudarte a negociar mejores condiciones. En ARE contamos con especialistas en financiamiento que te orientan sin costo.',
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
  TRUE
)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  excerpt = VALUES(excerpt),
  content = VALUES(content),
  image_url = VALUES(image_url),
  published = VALUES(published);
