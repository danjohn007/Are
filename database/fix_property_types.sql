-- Corrige tipos de propiedad en inglés (Tokko API) al español del CRM de Tokko
-- Ejecutar UNA SOLA VEZ en producción, luego correr un sync de Tokko

UPDATE properties SET property_type = 'Local'             WHERE LOWER(TRIM(property_type)) IN ('business premises','bussiness premises','local comercial','commercial','store');
UPDATE properties SET property_type = 'Edificio Comercial' WHERE LOWER(TRIM(property_type)) IN ('commercial building','building','edificio');
UPDATE properties SET property_type = 'Terreno'           WHERE LOWER(TRIM(property_type)) IN ('land','lot','lote');
UPDATE properties SET property_type = 'Bodega Industrial'  WHERE LOWER(TRIM(property_type)) IN ('storage','warehouse','bodega','bodega industrial');
UPDATE properties SET property_type = 'Nave Industrial'    WHERE LOWER(TRIM(property_type)) IN ('industrial','nave industrial');
UPDATE properties SET property_type = 'Casa'               WHERE LOWER(TRIM(property_type)) IN ('house','chalet','duplex','villa','townhouse','casa adosada');
UPDATE properties SET property_type = 'Departamento'       WHERE LOWER(TRIM(property_type)) IN ('apartment','ph','studio','room','habitación','estudio');
UPDATE properties SET property_type = 'Oficina'            WHERE LOWER(TRIM(property_type)) IN ('office');
UPDATE properties SET property_type = 'Rancho'             WHERE LOWER(TRIM(property_type)) IN ('ranch','farm');
UPDATE properties SET property_type = 'Campo'              WHERE LOWER(TRIM(property_type)) IN ('field','land field');

-- Verificar resultado
SELECT property_type, COUNT(*) AS total
FROM properties
GROUP BY property_type
ORDER BY property_type;
