// Semua teks yang dilihat anggota ada di file ini, dalam bahasa Indonesia
// (PLAN.md prinsip 8). Kode lain tidak boleh menulis kalimat sendiri; ia
// mengambil dari sini. Tes memeriksa bahwa tidak ada kata bahasa Inggris
// di dalamnya, dan bahwa setiap kode galat dari file SQL punya pesan.

// Pengecualian: spanduk "MODE CONTOH" sengaja tidak di sini, tetapi di App.jsx dalam
// cabang khusus pengembangan, supaya teksnya tidak ikut ke build produksi.
export const teks = {
  aplikasi: {
    nama: 'Silsilah Keluarga',
    sedangDibangun: 'Aplikasi ini sedang dibangun.',
    tidakDitemukanJudul: 'Halaman tidak ditemukan',
    tidakDitemukanIsi: 'Alamat yang Anda buka tidak ada di aplikasi ini.',
    kembaliKeAwal: 'Kembali ke halaman awal',
  },

  umum: {
    cobaLagi: 'Coba lagi',
    muatUlang: 'Muat ulang',
    tutup: 'Tutup',
    kembali: 'Kembali',
    memuat: 'Memuat…',
  },

  // Layar keadaan khusus (PLAN.md bagian 14, layar 28). Semuanya tanpa
  // menulis data apa pun.
  layar: {
    memuat: { judul: 'Memuat data', isi: 'Mohon tunggu sebentar.' },
    galat: { judul: 'Terjadi masalah', isi: 'Data belum bisa dimuat.' },
    dipulihkan: {
      judul: 'Aplikasi sedang dipulihkan',
      isi: 'Aplikasi sedang dipulihkan. Silakan coba lagi beberapa saat lagi.',
    },
    kosong: {
      judul: 'Belum ada data',
      isi: 'Belum ada data, hubungi admin.',
    },
    belumDiperbarui: {
      judul: 'Database belum diperbarui',
      isi: 'Aplikasi ini membutuhkan pembaruan database yang belum dilakukan. Hubungi admin.',
    },
    offline: {
      judul: 'Tidak ada koneksi internet',
      isi: 'Periksa sambungan internet Anda, lalu coba lagi.',
    },
    sesiHabis: {
      judul: 'Sesi berakhir',
      isi: 'Sesi Anda berakhir. Silakan masuk lagi.',
    },
  },

  // Pesan untuk setiap jenis galat (lihat src/lib/galat.js).
  galat: {
    dipulihkan: 'Aplikasi sedang dipulihkan. Silakan coba lagi beberapa saat lagi.',
    belumDiperbarui: 'Aplikasi membutuhkan pembaruan database yang belum dilakukan. Hubungi admin.',
    offline: 'Tidak ada koneksi internet. Periksa sambungan Anda, lalu coba lagi.',
    jaringan: 'Tidak bisa terhubung ke server. Periksa internet Anda, lalu coba lagi.',
    sesiHabis: 'Sesi Anda berakhir. Silakan masuk lagi.',
    tanpaIzin: 'Anda tidak punya izin untuk melakukan ini.',
    bentrok: 'Data ini baru saja diubah orang lain atau sudah tidak ada. Muat ulang, lalu coba lagi.',
    sibuk: 'Server sedang sibuk. Silakan coba lagi beberapa saat lagi.',
    terlaluSering: 'Terlalu banyak permintaan dalam waktu singkat. Silakan tunggu sebentar, lalu coba lagi.',
    server: 'Server sedang bermasalah. Silakan coba lagi beberapa saat lagi.',
    tidakDikenal:
      'Terjadi masalah yang tidak dikenal. Silakan coba lagi. Kalau terus terjadi, hubungi admin.',
    dataDitolak: 'Data ini tidak bisa disimpan karena tidak memenuhi aturan.',
    tidakDitemukan: 'Data yang dituju tidak ditemukan.',
    // Standar Postgres, tanpa nama batasan yang dikenal.
    standar: {
      '23502': 'Ada isian wajib yang masih kosong.',
      '23503': 'Data ini masih terkait dengan data lain, atau data yang dituju tidak ada lagi.',
      '23505': 'Data ini sudah ada.',
      '23514': 'Data ini tidak memenuhi aturan isian.',
      '22001': 'Ada isian yang terlalu panjang.',
      '22003': 'Ada angka yang terlalu besar atau terlalu kecil.',
      '22007': 'Ada tanggal yang tidak valid.',
      '22008': 'Ada tanggal yang tidak valid.',
      '22P02': 'Ada isian dengan bentuk yang tidak dikenali.',
    },
    // Nama batasan di file SQL 002 dan 004 → pesan untuk anggota.
    batasan: {
      people_birth_valid:
        'Tanggal lahir tidak valid. Bulan membutuhkan tahun, hari membutuhkan bulan, dan tanggalnya harus benar-benar ada.',
      people_death_valid:
        'Tanggal wafat tidak valid. Bulan membutuhkan tahun, hari membutuhkan bulan, dan tanggalnya harus benar-benar ada.',
      people_death_needs_deceased: 'Tanggal atau tempat wafat hanya bisa diisi untuk orang yang sudah wafat.',
      people_death_after_birth: 'Tahun wafat tidak bisa sebelum tahun lahir.',
      people_trash_consistent: 'Status tempat sampah data ini tidak sesuai. Muat ulang, lalu coba lagi.',
      unions_distinct_partners: 'Kedua pasangan tidak bisa orang yang sama.',
      unions_marriage_valid:
        'Tanggal menikah tidak valid. Bulan membutuhkan tahun, hari membutuhkan bulan, dan tanggalnya harus benar-benar ada.',
      unions_end_valid:
        'Tanggal berakhirnya pernikahan tidak valid. Bulan membutuhkan tahun, hari membutuhkan bulan, dan tanggalnya harus benar-benar ada.',
      unions_end_after_marriage: 'Pernikahan tidak bisa berakhir sebelum tahun menikah.',
      unions_trash_consistent: 'Status tempat sampah data ini tidak sesuai. Muat ulang, lalu coba lagi.',
      children_biological_matches_kind:
        'Jenis anak tidak cocok dengan orang tua kandungnya. Anak kandung dari keduanya, anak sambung dari salah satu, anak angkat tanpa hubungan darah.',
      children_trash_consistent: 'Status tempat sampah data ini tidak sesuai. Muat ulang, lalu coba lagi.',
      children_union_child_active: 'Anak ini sudah tercatat di pernikahan ini.',
      children_one_biological_active:
        'Anak ini sudah punya orang tua kandung yang tercatat. Anak sambung atau anak angkat bisa ditambahkan di pernikahan lain.',
      birth_ranks_not_self: 'Seseorang tidak bisa menjadi anak dari dirinya sendiri.',
      birth_ranks_unique_rank: 'Dua anak tidak bisa punya urutan lahir yang sama.',
      members_one_owner: 'Hanya boleh ada satu admin utama.',
      members_permissions_known: 'Izin yang dipilih tidak dikenal.',
      members_permissions_only_assistant: 'Izin tambahan hanya untuk asisten.',
      members_owner_is_member: 'Admin utama tidak bisa diubah.',
      members_revoked_consistent: 'Status anggota dan tanggal pencabutan tidak sesuai.',
      devices_temporary_has_expiry: 'Akses sementara harus punya batas waktu.',
      device_codes_minutes_match_kind: 'Durasi hanya berlaku untuk kode akses sementara.',
    },
    // Kode galat buatan kita di file SQL (private.fail). Pesan dari server
    // dipakai kalau berbahasa Indonesia (ada yang memuat nama dan waktu);
    // kalau tidak, pesan di bawah ini.
    kode: {
      AK001: 'Admin utama tidak bisa diubah atau dicabut lewat aplikasi.',
      AK002: 'Hanya admin utama yang boleh melakukan ini.',
      AK003: 'Undangan hanya untuk keturunan dan menantu di silsilah utama.',
      AK004: 'Orang ini belum dewasa (di bawah 18 tahun dan belum menikah), jadi belum bisa diundang.',
      AK005: 'Tanggal lahir orang ini tidak diketahui. Pastikan dulu bahwa ia sudah dewasa.',
      AK006: 'Link undangan ini sudah dipakai, kedaluwarsa, atau dicabut.',
      AK007: 'Perangkat hanya bisa didaftarkan untuk anggota yang aktif, dan perangkat yang sudah dicabut tidak bisa diaktifkan lagi.',
      AK008: 'Kode ini sudah dipakai, kedaluwarsa, atau dicabut.',
      AK009: 'Durasi akses sementara melebihi batas yang diatur admin.',
      AK010: 'Orang ini tercatat sudah wafat.',
      AK011: 'Akun login seorang anggota tidak bisa diganti.',
      AK012: 'Akses anggota ini sudah dicabut. Admin utama perlu mengaktifkannya dulu.',
      AK013: 'Fitur tambah perangkat sedang dimatikan oleh admin.',
      AK014: 'Perangkat dengan akses sementara tidak bisa menambah perangkat lain.',
      AK015: 'Anda tidak punya izin membuat link undangan.',
      AK016: 'Anda tidak punya izin memberi akses sementara.',
      AK017: 'Link dan kode untuk admin utama atau asisten hanya bisa dibuat oleh admin utama.',
      AK018: 'Peran untuk undangan hanya "hanya melihat" atau "anggota". Peran anggota yang sudah terdaftar diubah di daftar anggota.',
      AK019: 'Pendaftaran perangkat ini tidak berlaku lagi. Mintalah link atau kode baru.',
      AK020: 'Sesi ini sudah terdaftar sebagai perangkat lain. Keluar dulu, lalu masuk lagi.',
      AK021: 'Anda belum masuk. Silakan masuk dulu.',
      AK022: 'Durasi akses sementara minimal 30 menit.',
      AK023: 'Akun Anda sedang ditahan sementara, jadi belum bisa menambah perangkat. Hubungi admin.',
      AK024: 'Perangkat ini tidak ditemukan, atau bukan milik Anda.',
      RP001: 'Anda tidak bisa mengirim laporan (hanya melihat, atau sedang ditahan).',
      RP002: 'Data yang dilaporkan tidak ditemukan.',
      RP003: 'Anda sudah mengirim banyak laporan dalam satu jam terakhir. Silakan coba lagi nanti.',
      RP004: 'Anda tidak punya izin untuk menindaklanjuti laporan ini.',
      SL001: 'Hubungan ini membuat silsilah berputar: seseorang tidak bisa menjadi anak dari dirinya sendiri atau dari keturunannya.',
      SL002: 'Pasangan pangkal tidak boleh punya orang tua di silsilah utama.',
      SL003: 'Data yang saling terkait harus berada di pohon yang sama.',
      SL004: 'Pasangan tidak bisa diberi orang tua di silsilah utama. Keluarga asal pasangan dicatat di pohon keluarga asal.',
      SL005: 'Pernikahan dan anak di silsilah utama hanya bisa dicatat di bawah keturunan pasangan pangkal.',
      SL006: 'Bagian data ini tidak boleh diubah setelah dibuat. Buat data baru kalau perlu.',
      SL007: 'Urutan lahir hanya bisa dicatat untuk anak dari orang tua tersebut.',
      SL008: 'Data ini sedang berada di tempat sampah. Pulihkan dulu sebelum dipakai.',
      SL009: 'Pohon keluarga asal hanya bisa dibuat untuk pasangan (bukan keturunan) di silsilah utama.',
      TR001: 'Anda tidak punya izin tempat sampah.',
      TR002: 'Masih ada anak yang aktif. Pindahkan atau buang anak-anaknya dulu.',
      TR003: 'Orang ini punya pohon keluarga asal. Admin utama perlu mengurus pohon itu dulu.',
      TR004: 'Pasangan pangkal dan pernikahannya tidak bisa dibuang atau dihapus.',
      TR005: 'Orang ini anggota aplikasi. Admin utama perlu mencabut aksesnya dulu.',
      TR006: 'Data tidak ditemukan atau sudah di tempat sampah.',
      TR007: 'Data di kelompok ini masih dipakai data lain. Hapus permanen kelompok yang terkait lebih dulu, atau sekaligus.',
      TR008: 'Hanya admin utama (dengan verifikasi dua langkah) yang bisa menghapus permanen.',
      TR009: 'Ketik HAPUS (huruf besar) untuk memastikan penghapusan permanen.',
      TR010: 'Hubungan ini satu-satunya yang menyambungkan orang ini ke silsilah, dan ia sudah berkeluarga. Gunakan "pindahkan ke orang tua lain".',
      TR011: 'Kelompok data ini tidak ada di tempat sampah.',
      TR012: 'Data pohon keluarga asal hanya bisa diatur admin utama.',
      UN001: 'Perubahan ini tidak ditemukan.',
      UN002: 'Perubahan ini sudah dibatalkan.',
      UN003: 'Data ini sudah berubah sejak perubahan itu, jadi tidak bisa dibatalkan otomatis. Silakan ubah secara manual.',
      UN004: 'Hapus permanen tidak bisa dibatalkan. Data hanya bisa dipulihkan dari cadangan oleh admin utama.',
      UN005: 'Pembuatan pohon keluarga asal tidak bisa dibatalkan dari riwayat.',
      UN006: 'Anda hanya bisa membatalkan perubahan Anda sendiri.',
      UN007: 'Hanya admin utama yang bisa membatalkan perubahan ini.',
      UN008: 'Anda tidak bisa membatalkan perubahan (hanya melihat, atau sedang ditahan).',
    },
  },

  // Hasil memakai link undangan atau kode perangkat (Edge Function
  // pakai-undangan dan pakai-kode; lihat src/lib/masuk.js).
  masuk: {
    undangan: {
      tidak_dikenal: 'Link ini tidak dikenali. Pastikan Anda membuka link lengkap dari admin, atau mintalah link baru.',
      sudah_dipakai: 'Link ini sudah dipakai. Kalau Anda belum pernah masuk, hubungi admin keluarga.',
      kedaluwarsa: 'Link ini sudah kedaluwarsa. Mintalah link baru kepada admin.',
      dicabut: 'Link ini sudah dibatalkan. Mintalah link baru kepada admin.',
      terlalu_sering: 'Terlalu banyak percobaan yang salah. Tunggu 15 menit, lalu coba lagi.',
    },
    kode: {
      format_salah: 'Kode terdiri dari 8 huruf dan angka, misalnya ABCD-2345. Periksa lagi kodenya.',
      salah: 'Kode salah. Periksa lagi kodenya, lalu coba lagi.',
      sudah_dipakai: 'Kode ini sudah dipakai. Buat atau mintalah kode baru.',
      kedaluwarsa: 'Kode ini sudah tidak berlaku (lebih dari 10 menit). Buat atau mintalah kode baru.',
      dicabut: 'Kode ini sudah dibatalkan. Buat atau mintalah kode baru.',
      dimatikan: 'Fitur tambah perangkat sedang dimatikan oleh admin.',
      terlalu_sering: 'Terlalu banyak percobaan kode yang salah. Tunggu 15 menit, lalu coba lagi.',
    },
  },

  // Perkiraan lokasi login (Edge Function, data DB-IP Lite). Atribusi wajib
  // ditampilkan di halaman Privasi (lisensi CC BY 4.0).
  lokasi: {
    sekitar: 'sekitar',
    tidakDiketahui: 'lokasi tidak diketahui',
    atribusi: 'Perkiraan lokasi dari alamat IP memakai data DB-IP (db-ip.com), lisensi CC BY 4.0.',
  },

  // Label silsilah: kartu, detail, dan istilah kerabat (src/lib/silsilah/).
  silsilah: {
    almL: 'Alm.',
    almP: 'Almh.',
    almNetral: 'Alm./Almh.',
    pasanganDari: 'Pasangan dari',
    bercerai: 'bercerai',
    dari: 'dari',
    dan: 'dan',
    diriSendiri: 'Diri sendiri',
    lahirDi: 'di',
    sekitar: 'sekitar',
    anakKe: 'Anak ke-',
    jenisPasangan: { istri: 'istri', suami: 'suami', pasangan: 'pasangan' },
    jenisAnak: { kandung: null, sambung: 'Anak sambung', angkat: 'Anak angkat' },
    generasiKe: 'Generasi ke-',
    statusPernikahan: {
      menikah: 'Menikah',
      cerai: 'Bercerai',
      tidak_diketahui: 'Status tidak diketahui',
    },
    bulan: [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ],
    kerabat: {
      bapak: 'Bapak',
      ibu: 'Ibu',
      orangTua: 'Orang tua',
      mbah: 'Mbah',
      mbahBuyut: 'Mbah buyut',
      mbahCanggah: 'Mbah canggah',
      mbahWareng: 'Mbah wareng',
      kakak: 'Kakak',
      adik: 'Adik',
      kakakAdik: 'Kakak/Adik',
      ipar: 'Ipar',
      keponakan: 'Keponakan',
      sepupu: 'Sepupu',
      anak: 'Anak',
      cucu: 'Cucu',
      cicit: 'Cicit',
      suami: 'Suami',
      istri: 'Istri',
      pasangan: 'Pasangan',
      pakdhe: 'Pakdhe',
      budhe: 'Budhe',
      paklik: 'Paklik',
      bulik: 'Bulik',
      pakdheBudhe: 'Pakdhe/Budhe',
      paklikBulik: 'Paklik/Bulik',
      pakdhePaklik: 'Pakdhe/Paklik',
      budheBulik: 'Budhe/Bulik',
      pamanBibi: 'Paman/Bibi',
    },
  }
}
