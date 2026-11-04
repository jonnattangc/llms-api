-- Checksum (md5) del contenido de la fuente en la última sincronización correcta. Si no cambió,
-- la fuente no se descarga ni se procesa. Ejecutar una vez sobre un registro creado con 001.
USE llm_manager;

ALTER TABLE rag_sources
  ADD COLUMN remote_checksum CHAR(32) NULL AFTER name;
