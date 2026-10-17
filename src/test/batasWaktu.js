// Batas waktu untuk tes tampilan berat (memasang seluruh Bagan atau Daftar,
// pemeriksaan axe, alur beberapa layar): 15 detik, bukan 5 detik bawaan.
// Sendirian tes-tes ini butuh sekitar 1–5 detik; saat semua tes jalan
// bersamaan bisa lebih dari 5 detik. Hanya batas waktunya yang berbeda,
// isi tesnya tidak.
export const BERAT = { timeout: 15_000 }
