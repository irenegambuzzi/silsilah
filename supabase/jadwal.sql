-- Jadwal tugas otomatis (pg_cron). File ini KUMULATIF: berisi semua
-- jadwal aplikasi. Jalankan SETELAH semua file bernomor (001, 002, …),
-- dan jalankan lagi setiap kali file ini berubah. Aman dijalankan ulang:
-- jadwal dengan nama yang sama diperbarui, bukan digandakan.
--
-- Waktu pg_cron memakai UTC (WIB = UTC + 7).
--
-- Jadwal saat ini:
--   hapus-ip-lama   setiap hari 20.15 UTC (03.15 WIB): menghapus alamat IP
--                   login yang berumur lebih dari 30 hari.
--
-- Kalau perintah "create extension" gagal: Dashboard → Database →
-- Extensions → cari "pg_cron" → aktifkan, lalu jalankan file ini lagi.
--
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('hapus-ip-lama', '15 20 * * *', $$select private.purge_old_login_ips()$$);

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Jadwal hapus-ip-lama aktif' as pemeriksaan,
       (select count(*)::text from cron.job where jobname = 'hapus-ip-lama' and active) as hasil,
       '1' as harus;
