-- ============================================================
--  VOIZ — Database Schema
--  Engine: MySQL 8+
-- ============================================================

CREATE DATABASE IF NOT EXISTS voiz_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE voiz_db;

-- ------------------------------------------------------------
-- 1. USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama          VARCHAR(120)        NOT NULL,
  email         VARCHAR(180)        NOT NULL UNIQUE,
  password_hash VARCHAR(255)        NOT NULL,
  role          ENUM('mahasiswa','admin','pimpinan') NOT NULL DEFAULT 'mahasiswa',
  nim           VARCHAR(20)         NULL,
  prodi         VARCHAR(100)        NULL,
  avatar_url    VARCHAR(255)        NULL,
  is_active     TINYINT(1)          NOT NULL DEFAULT 1,
  created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. KATEGORI ASPIRASI
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kategori (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama       VARCHAR(80)  NOT NULL UNIQUE,
  icon       VARCHAR(40)  NOT NULL DEFAULT 'tag',   -- lucide icon name
  warna      VARCHAR(20)  NOT NULL DEFAULT '#6366f1',
  deskripsi  TEXT         NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed data
INSERT INTO kategori (nama, icon, warna, deskripsi) VALUES
  ('Akademik',  'book-open',  '#6366f1', 'Perkuliahan, kurikulum, dosen, ujian'),
  ('Fasilitas', 'building-2', '#f59e0b', 'Gedung, lab, toilet, parkir, wifi'),
  ('Sosial',    'users',      '#10b981', 'Kegiatan mahasiswa, organisasi, lingkungan kampus'),
  ('Keuangan',  'banknote',   '#ef4444', 'UKT, beasiswa, biaya administrasi'),
  ('Lainnya',   'more-horizontal', '#8b5cf6', 'Aspirasi di luar kategori utama');

-- ------------------------------------------------------------
-- 3. ASPIRASI
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aspirasi (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED        NULL,          -- NULL = benar-benar anonim
  kategori_id   INT UNSIGNED        NOT NULL,
  judul         VARCHAR(200)        NOT NULL,
  isi           TEXT                NOT NULL,
  is_anonim     TINYINT(1)          NOT NULL DEFAULT 0,
  status        ENUM(
                  'menunggu',
                  'diterima',
                  'diproses',
                  'selesai',
                  'ditolak'
                ) NOT NULL DEFAULT 'menunggu',
  prioritas     ENUM('rendah','sedang','tinggi') NOT NULL DEFAULT 'sedang',
  lampiran_url  VARCHAR(255)        NULL,
  vote_count    INT UNSIGNED        NOT NULL DEFAULT 0,  -- denormalized counter
  created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_aspirasi_user     FOREIGN KEY (user_id)     REFERENCES users(id)    ON DELETE SET NULL,
  CONSTRAINT fk_aspirasi_kategori FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Full-text search
ALTER TABLE aspirasi ADD FULLTEXT INDEX ft_aspirasi (judul, isi);

-- ------------------------------------------------------------
-- 4. VOTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS votes (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  aspirasi_id  INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_vote (aspirasi_id, user_id),   -- 1 vote per user per aspirasi
  CONSTRAINT fk_vote_aspirasi FOREIGN KEY (aspirasi_id) REFERENCES aspirasi(id) ON DELETE CASCADE,
  CONSTRAINT fk_vote_user     FOREIGN KEY (user_id)     REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. STATUS LOG (audit trail)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_log (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  aspirasi_id  INT UNSIGNED NOT NULL,
  admin_id     INT UNSIGNED NULL,
  status_lama  VARCHAR(20)  NULL,
  status_baru  VARCHAR(20)  NOT NULL,
  catatan      TEXT         NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_log_aspirasi FOREIGN KEY (aspirasi_id) REFERENCES aspirasi(id) ON DELETE CASCADE,
  CONSTRAINT fk_log_admin    FOREIGN KEY (admin_id)    REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. NOTIFIKASI
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifikasi (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  aspirasi_id  INT UNSIGNED NULL,
  judul        VARCHAR(200) NOT NULL,
  pesan        TEXT         NOT NULL,
  is_read      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notif_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_notif_aspirasi FOREIGN KEY (aspirasi_id) REFERENCES aspirasi(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. ADMIN SEED (password: admin123 — ganti di production!)
-- ------------------------------------------------------------
INSERT INTO users (nama, email, password_hash, role) VALUES
  ('Admin BEM', 'admin@voiz.id',
   '$2b$12$KIXnJ9zTqr1q1q1q1q1q1uXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
   'admin');
-- CATATAN: hash di atas adalah placeholder.
-- Jalankan: node -e "require('bcrypt').hash('admin123',12,(_,h)=>console.log(h))"
-- lalu UPDATE users SET password_hash='<hasil>' WHERE email='admin@voiz.id';