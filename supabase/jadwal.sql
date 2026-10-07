-- Jadwal tugas otomatis (pg_cron). File ini KUMULATIF: berisi semua
-- jadwal aplikasi. Jalankan SETELAH semua file bernomor (001, 002, …),
-- dan jalankan lagi setiap kali file ini berubah. Aman dijalankan ulang:
-- jadwal dengan nama yang sama diperbarui, bukan digandakan.
--
-- Waktu pg_cron memakai UTC (WIB = UTC + 7).
--
-- Jadwal saat ini:
--   salinan-harian  setiap hari 19.00 UTC (02.00 WIB): salinan database
--                   (hanya kalau ada perubahan) + merapikan salinan lama.
--   hapus-ip-lama   setiap hari 20.15 UTC (03.15 WIB): menghapus alamat IP
--                   login yang berumur lebih dari 30 hari.
--   hapus-percobaan-lama  setiap hari 20.20 UTC (03.20 WIB): menghapus
--                   catatan percobaan link/kode yang salah (berisi alamat
--                   IP) dan tiket klaim perangkat yang berumur lebih dari
--                   1 hari.
--
-- Kalau perintah "create extension" gagal: Dashboard → Database →
-- Extensions → cari "pg_cron" → aktifkan, lalu jalankan file ini lagi.
--
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('salinan-harian', '0 19 * * *', $$select private.daily_snapshot()$$);
select cron.schedule('hapus-ip-lama', '15 20 * * *', $$select private.purge_old_login_ips()$$);
select cron.schedule('hapus-percobaan-lama', '20 20 * * *', $$select private.purge_redeem_data()$$);

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Jadwal salinan-harian aktif' as pemeriksaan,
       (select count(*)::text from cron.job where jobname = 'salinan-harian' and active) as hasil,
       '1' as harus
union all
select 'Jadwal hapus-ip-lama aktif',
       (select count(*)::text from cron.job where jobname = 'hapus-ip-lama' and active),
       '1'
union all
select 'Jadwal hapus-percobaan-lama aktif',
       (select count(*)::text from cron.job where jobname = 'hapus-percobaan-lama' and active),
       '1';
