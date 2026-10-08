// MODE CONTOH: alamat dan nomor HP FIKTIF untuk anggota keluarga fiktif
// (src/lib/silsilah/keluargaFiktif.js), supaya siap dipakai saat fitur data
// kontak dibuat (PLAN.md bagian 7, langkah 2.8–2.9). Bentuknya mengikuti
// private.contacts, tetapi tidak terenkripsi karena semuanya rekaan:
//   { person_id, alamat, hp, wilayah, provinsi, negara }
// Nomor HP sengaja berpola 0812-0000-00xx (dan satu nomor Italia
// +39 333 000 00xx) supaya jelas bukan nomor sungguhan. Jalan, kelurahan,
// dan kota rekaan; hanya nama provinsi yang nyata. Hanya dimuat lewat
// klienContoh.js (build pengembangan); tes build memastikan TIDAK ikut ke
// build produksi.
export const PENANDA_KONTAK_CONTOH = 'KONTAK-CONTOH-FIKTIF'

const kontak = (person_id, alamat, hp, wilayah = 'Kota Contoh', provinsi = 'Jawa Tengah', negara = 'Indonesia') => ({
  person_id, alamat, hp, wilayah, provinsi, negara,
})

export const kontakContoh = [
  kontak('bima', 'Jl. Melati Contoh No. 1, RT 01/RW 02, Kel. Sukacontoh', '0812-0000-0001'),
  kontak('gita', 'Jl. Melati Contoh No. 1, RT 01/RW 02, Kel. Sukacontoh', '0812-0000-0002'),
  kontak('eka', 'Perum Griya Contoh Blok B-7, Kel. Mekarcontoh', '0812-0000-0003', 'Kabupaten Contoh', 'DI Yogyakarta'),
  kontak('fitri', 'Jl. Kenanga Contoh No. 22', '0812-0000-0004', 'Kota Contoh Timur', 'Jawa Timur'),
  kontak('cahya', 'Jl. Anggrek Contoh No. 5, RT 03/RW 01', '0812-0000-0005'),
  kontak('umar', 'Jl. Anggrek Contoh No. 5, RT 03/RW 01', null),
  kontak('lorvan', 'Dusun Contoh RT 02/RW 04, Desa Contoh', '0812-0000-0007', 'Kabupaten Contoh', 'DI Yogyakarta'),
  kontak('sinta', 'Dusun Contoh RT 02/RW 04, Desa Contoh', '0812-0000-0008', 'Kabupaten Contoh', 'DI Yogyakarta'),
  kontak('tamran', 'Jl. Flamboyan Contoh No. 9', '0812-0000-0009', 'Kota Contoh Barat', 'Jawa Barat'),
  kontak('wati', 'Jl. Flamboyan Contoh No. 9', '0812-0000-0010', 'Kota Contoh Barat', 'Jawa Barat'),
  kontak('ika', 'Jl. Cempaka Contoh Gg. 3 No. 14', '0812-0000-0011'),
  kontak('joval', 'Jl. Cempaka Contoh Gg. 3 No. 14', '0812-0000-0012'),
  kontak('dara', 'Jl. Teratai Contoh No. 30', '0812-0000-0013', 'Kota Lain Contoh', 'Jawa Timur'),
  kontak('kirana', null, '0812-0000-0014'),
  kontak('mega', 'Apartemen Contoh Tower A Lt. 8 No. 3', '0812-0000-0015', 'Kota Contoh Raya', 'DKI Jakarta'),
  kontak('oka', 'Jl. Dahlia Contoh No. 2', '0812-0000-0016', 'Kota Contoh Barat', 'Banten'),
  kontak('putri', 'Via Esempio 7', '+39 333 000 0017', 'Milano', 'Lombardia', 'Italia'),
  kontak('rangga', 'Jl. Kamboja Contoh No. 11', '0812-0000-0018'),
  kontak('gendis', 'Jl. Kamboja Contoh No. 11', '0812-0000-0019'),
  kontak('kelvan', 'Jl. Seroja Contoh No. 4', '0812-0000-0020', 'Kabupaten Contoh', 'DI Yogyakarta'),
  kontak('dorvi', 'Kos Contoh Kamar 6, Jl. Mawar Contoh No. 40', '0812-0000-0021', 'Kota Contoh Raya', 'DKI Jakarta'),
  kontak('laras', 'Jl. Cempaka Contoh Gg. 3 No. 14', '0812-0000-0022'),
  kontak('rinzo', 'Jl. Teratai Contoh No. 30', '0812-0000-0023', 'Kota Lain Contoh', 'Jawa Timur'),
  // Anak di bawah umur: hanya alamat (ikut orang tuanya), tanpa nomor HP.
  kontak('bayu', 'Jl. Cempaka Contoh Gg. 3 No. 14', null),
]
