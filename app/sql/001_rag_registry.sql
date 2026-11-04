-- Registro de archivos dinámicos del RAG. Idempotente: se puede ejecutar varias veces.
CREATE DATABASE IF NOT EXISTS llm_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE llm_manager;

-- Fuentes dinámicas de cada sistema (ej: una planilla de Google Sheets).
CREATE TABLE IF NOT EXISTS rag_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(30) NOT NULL,              -- 'google-sheet'
  reference VARCHAR(255) NOT NULL,        -- spreadsheetId
  system_id CHAR(36) NOT NULL,
  name VARCHAR(255) NULL,
  remote_modified_at DATETIME(3) NULL,    -- modifiedTime de Drive en la última revisión
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_source (type, reference, system_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Archivos que cada fuente entrega al RAG (en Google Sheets, uno por pestaña).
CREATE TABLE IF NOT EXISTS rag_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,         -- con extensión: Tesorería_3°_A_y_B_Cuotas.md
  md5sum CHAR(32) NOT NULL,               -- decide si el contenido cambió
  size_bytes INT NOT NULL,
  origin VARCHAR(30) NOT NULL,            -- 'google-sheet'
  system_id CHAR(36) NOT NULL,
  source_id INT NOT NULL,
  rag_document_id CHAR(36) NULL,          -- document_id que devuelve la RAG-API
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_indexed_at DATETIME NULL,          -- última carga en el RAG
  update_count INT NOT NULL DEFAULT 0,    -- veces que se re-indexó por cambio de contenido
  metadata JSON NULL,
  UNIQUE KEY uq_file (system_id, filename),
  KEY idx_source (source_id),
  CONSTRAINT fk_rag_files_source FOREIGN KEY (source_id) REFERENCES rag_sources(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
