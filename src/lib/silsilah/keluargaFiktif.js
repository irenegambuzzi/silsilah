// Keluarga FIKTIF untuk tes logika silsilah (nama karangan, bukan keluarga
// sungguhan). Barisnya berbentuk persis seperti dari database. Dirancang
// supaya setiap kasus rumit di PLAN.md bagian 15.1 ada contohnya:
//
//   Pangkal: Raksa + Selara (GEN.0), anak: Bima, Cahya, Lorvan.
//   Bima: 4 pernikahan dengan 3 pasangan. Eka (istri ke-1) menikah dua kali
//         (pernikahan berulang). Anak ke-1–3 dari istri ke-1, 4–5 dari istri
//         ke-2, 6–7 kembali dari istri ke-1, 8–11 dari istri ke-3.
//   Cahya + Umar: Vino anak sambung (anak Umar), Wati anak kandung.
//   Lorvan + Sinta: Yoga anak angkat. Anak Lorvan, Kelvan, punya Gendis.
//   Tamran + Wati: pernikahan antarsepupu, kedua orang tua sama GEN-nya.
//   Rangga + Gendis: pernikahan antarsepupu, GEN orang tuanya berbeda
//         (Rangga GEN.2, Gendis GEN.3), jadi anak mereka mengikuti Rangga.
//   Ika: ditinggal wafat suami ke-1 (H. Halvin), lalu menikah lagi (Joval).
//         Anak: Dorvi (gelar, panggilan, tanggal lengkap), Sekar (wafat saat
//         bayi), Laras, dan Bayu (di bawah umur, dari suami ke-2).
//   Tirwan: keturunan yang sudah wafat; istrinya Hj. Dara ditinggal wafat.
//         Anak: Rinzo, Nala (di bawah umur), Ragil (jenis kelamin tidak
//         diketahui). Dara = pasangan khusus B (istri anak Eka).
//   Lintang: pasangan tidak diketahui, satu anak (Arya).
//   Tanggal kabur: tahun saja, "sekitar", bulan dan tahun, tanggal lengkap.
//
//   Pohon keluarga asal Eka ("T1"): orang tuanya, saudaranya, Mbah, Mbah
//   buyut, Pakdhe/Budhe/Paklik/Bulik, sepupu, keponakan, dan satu paman
//   yang urutan lahirnya tidak diketahui.
//   Pohon keluarga asal Dara ("T2"): orang tua, adik, Mbah, dan Pakdhe.

export function bangunKeluargaFiktif() {
  const data = {
    people: [],
    unions: [],
    children: [],
    birth_ranks: [],
    origin_trees: [
      { id: 'T1', anchor_person_id: 'eka', is_active: true },
      { id: 'T2', anchor_person_id: 'dara', is_active: true },
    ],
    root_union_id: null,
  }
  const tanpaUrutan = new Set()
  let detik = 0
  const stempel = () => new Date(Date.UTC(2026, 0, 1, 0, 0, detik++)).toISOString()

  const orang = (id, nama, sex, lahir, tambahan = {}) => {
    data.people.push({
      id,
      tree_id: null,
      full_name: nama,
      nickname: null,
      religious_title: null,
      academic_title: null,
      sex,
      birth_y: lahir ?? null,
      birth_m: null,
      birth_d: null,
      birth_approx: false,
      birth_place: null,
      is_deceased: false,
      death_y: null,
      death_m: null,
      death_d: null,
      death_approx: false,
      death_place: null,
      deleted_at: null,
      created_at: stempel(),
      ...tambahan,
    })
    return id
  }
  const asal = (id, nama, sex, lahir, tambahan = {}) =>
    orang(id, nama, sex, lahir, { tree_id: 'T1', ...tambahan })
  const asal2 = (id, nama, sex, lahir, tambahan = {}) =>
    orang(id, nama, sex, lahir, { tree_id: 'T2', ...tambahan })

  const nikah = (id, partner1, partner2, tambahan = {}) => {
    data.unions.push({
      id,
      tree_id: null,
      partner1_id: partner1,
      partner2_id: partner2,
      status: 'menikah',
      marriage_y: null,
      marriage_m: null,
      marriage_d: null,
      marriage_approx: false,
      end_y: null,
      end_m: null,
      end_d: null,
      end_approx: false,
      sort_order: null,
      deleted_at: null,
      created_at: stempel(),
      ...tambahan,
    })
    return id
  }
  const nikahAsal = (id, p1, p2, tambahan = {}) => nikah(id, p1, p2, { tree_id: 'T1', ...tambahan })

  const anak = (union, child, kind = 'kandung', tambahan = {}) => {
    const bio = { kandung: 'keduanya', sambung: 'partner2', angkat: null }[kind]
    data.children.push({
      id: `c-${union}-${child}`,
      tree_id: null,
      union_id: union,
      child_id: child,
      kind,
      biological_parent: bio,
      deleted_at: null,
      created_at: stempel(),
      ...tambahan,
    })
  }
  const anakAsal = (union, child, kind = 'kandung') => anak(union, child, kind, { tree_id: 'T1' })
  const nikahAsal2 = (id, p1, p2, tambahan = {}) => nikah(id, p1, p2, { tree_id: 'T2', ...tambahan })
  const anakAsal2 = (union, child) => anak(union, child, 'kandung', { tree_id: 'T2' })

  // ── Silsilah utama ──────────────────────────────────────────────
  orang('raksa', 'Raksa', 'L', 1920, { is_deceased: true, death_y: 1990 })
  orang('selara', 'Selara', 'P', 1925, { is_deceased: true, death_y: 2001 })
  nikah('u-root', 'raksa', 'selara', { marriage_y: 1943 })
  data.root_union_id = 'u-root'

  orang('bima', 'Bima', 'L', 1945)
  orang('cahya', 'Cahya', 'P', 1948)
  orang('lorvan', 'Lorvan', 'L', 1951)
  for (const a of ['bima', 'cahya', 'lorvan']) anak('u-root', a)

  orang('eka', 'Eka', 'P', 1950)
  orang('fitri', 'Fitri', 'P', 1952)
  orang('gita', 'Gita', 'P', 1960)
  nikah('u1', 'bima', 'eka', { marriage_y: 1970, status: 'cerai', end_y: 1976 })
  nikah('u2', 'bima', 'fitri', { marriage_y: 1977, status: 'cerai', end_y: 1981 })
  nikah('u3', 'bima', 'eka', { marriage_y: 1982, status: 'cerai', end_y: 1986 })
  nikah('u4', 'bima', 'gita', { marriage_y: 1987 })
  const anakBima = [
    ['u1', 'tamran', 'Tamran', 'L', 1971],
    ['u1', 'ika', 'Ika', 'P', 1973],
    ['u1', 'tirwan', 'Tirwan', 'L', 1975],
    ['u2', 'kirana', 'Kirana', 'P', 1978],
    ['u2', 'lintang', 'Lintang', 'L', 1980],
    ['u3', 'mega', 'Mega', 'P', 1983],
    ['u3', 'nanda', 'Nanda', 'L', 1985],
    ['u4', 'oka', 'Oka', 'L', 1988],
    ['u4', 'putri', 'Putri', 'P', 1990],
    ['u4', 'qori', 'Qori', 'L', 1992],
    ['u4', 'rangga', 'Rangga', 'L', 1994],
  ]
  for (const [u, id, nama, sex, lahir] of anakBima) {
    orang(id, nama, sex, lahir)
    anak(u, id)
  }

  orang('umar', 'Umar', 'L', 1940)
  nikah('u5', 'cahya', 'umar', { marriage_y: 1974 })
  orang('vino', 'Vino', 'L', 1972)
  orang('wati', 'Wati', 'P', 1977)
  anak('u5', 'vino', 'sambung')
  anak('u5', 'wati')

  orang('sinta', 'Sinta', 'P', 1955)
  nikah('u6', 'lorvan', 'sinta', { marriage_y: 1975 })
  orang('kelvan', 'Kelvan', 'L', 1976)
  orang('yoga', 'Yoga', 'L', 1983)
  anak('u6', 'kelvan')
  anak('u6', 'yoga', 'angkat')
  orang('laila', 'Laila', 'P', 1978)
  nikah('u7', 'kelvan', 'laila', { marriage_y: 1998 })
  orang('gendis', 'Gendis', 'P', 2000)
  anak('u7', 'gendis')

  // Pernikahan antarsepupu, GEN orang tua sama (Tamran dan Wati, keduanya GEN.2).
  nikah('u9', 'tamran', 'wati', { marriage_y: 1998 })
  orang('nirvo', 'Nirvo', 'L', 1999)
  anak('u9', 'nirvo')
  // Pernikahan antarsepupu, GEN orang tua berbeda (Rangga GEN.2, Gendis GEN.3).
  nikah('u8', 'rangga', 'gendis', { marriage_y: 2022 })
  orang('hasna', 'Hasna', 'P', 2024)
  anak('u8', 'hasna')

  // Ditinggal wafat lalu menikah lagi; anak wafat saat bayi; gelar; tanggal kabur.
  orang('halvin', 'Halvin', 'L', 1968, {
    birth_approx: true, religious_title: 'H.', is_deceased: true, death_y: 2008, death_m: 8,
    death_place: 'Kota Contoh', occupation: 'Petani', nickname: 'Pak Halvin',
  })
  nikah('u10', 'ika', 'halvin', { marriage_y: 1995 })
  orang('dorvi', 'Dorvi', 'L', 1996, {
    birth_m: 3, birth_d: 12, birth_place: 'Kota Contoh', academic_title: 'S.Kom.', nickname: 'Orvi', occupation: 'Guru',
  })
  orang('sekar', 'Sekar', 'P', 1998, {
    birth_m: 5, birth_d: 3, birth_place: 'Kota Contoh', is_deceased: true, death_y: 1998, death_m: 5, death_d: 20,
    notes: 'Wafat saat masih bayi. Dimakamkan di makam keluarga.',
  })
  orang('laras', 'Laras', 'P', 2001, { birth_place: 'Desa Contoh', academic_title: 'S.Ked.', occupation: 'Dokter muda' })
  for (const a of ['dorvi', 'sekar', 'laras']) anak('u10', a)
  orang('joval', 'Joval', 'L', 1970, { academic_title: 'S.E.', nickname: 'Mas Joval', occupation: 'Pedagang' })
  nikah('u11', 'ika', 'joval', { marriage_y: 2012, marriage_m: 2 })
  orang('bayu', 'Bayu', 'L', 2013, { birth_place: 'Kota Contoh' })
  anak('u11', 'bayu')

  // Keturunan yang sudah wafat, dengan istri yang ditinggal wafat.
  Object.assign(data.people.find((p) => p.id === 'tirwan'), {
    is_deceased: true, death_y: 2015, death_place: 'Kota Contoh', occupation: 'Pegawai negeri',
    notes: 'Dikenal suka menanam pohon mangga di halaman rumah.',
  })
  orang('dara', 'Dara', 'P', 1978, { birth_m: 6, religious_title: 'Hj.', nickname: 'Mbak Dara', birth_place: 'Kota Lain Contoh' })
  nikah('u12', 'tirwan', 'dara', { marriage_y: 2000 })
  orang('rinzo', 'Rinzo', 'L', 2003)
  orang('nala', 'Nala', 'P', 2010)
  orang('ragil', 'Ragil', null, 2014)
  for (const a of ['rinzo', 'nala', 'ragil']) anak('u12', a)

  // Pasangan tidak diketahui.
  nikah('u13', 'lintang', null, { status: 'tidak_diketahui' })
  orang('arya', 'Arya', 'L', 2005)
  anak('u13', 'arya')

  // ── Pohon keluarga asal Eka ─────────────────────────────────────
  asal('karto', 'Karto', 'L', 1860)
  asal('sumi', 'Sumi', 'P', 1865)
  nikahAsal('ou8', 'karto', 'sumi')
  asal('kasan', 'Kasan', 'L', 1895)
  asal('siti', 'Siti', 'P', 1900)
  anakAsal('ou8', 'kasan')
  nikahAsal('ou2', 'kasan', 'siti')
  // Anak-anak Mbah: Kardi (1) > Murni (2) > Salim (3) > Lukman (4); Darma tanpa tanggal lahir.
  asal('kardi', 'Kardi', 'L', 1920)
  asal('murni', 'Murni', 'P', 1922)
  asal('salim', 'Salim', 'L', 1925)
  asal('lukman', 'Lukman', 'L', 1930)
  asal('darma', 'Darma', 'L', null)
  for (const a of ['kardi', 'murni', 'salim', 'lukman', 'darma']) anakAsal('ou2', a)
  tanpaUrutan.add('darma')

  asal('wiwik', 'Wiwik', 'P', 1924)
  nikahAsal('ou4', 'kardi', 'wiwik')
  asal('dwi', 'Dwi', 'P', 1950)
  anakAsal('ou4', 'dwi')
  asal('brenno', 'Brenno', 'L', 1948)
  nikahAsal('ou5', 'dwi', 'brenno')
  asal('fani', 'Fani', 'P', 1975)
  anakAsal('ou5', 'fani')

  asal('parno', 'Parno', 'L', 1918)
  nikahAsal('ou3', 'murni', 'parno')
  asal('tini', 'Tini', 'P', 1932)
  nikahAsal('ou6', 'lukman', 'tini')
  asal('ening', 'Ening', 'P', 1935)
  nikahAsal('ou9', 'darma', 'ening')

  asal('marni', 'Marni', 'P', 1930)
  nikahAsal('ou1', 'salim', 'marni')
  asal('ratna', 'Ratna', 'P', 1948)
  asal('jaya', 'Jaya', 'L', 1953)
  anakAsal('ou1', 'ratna')
  anakAsal('ou1', 'eka') // Eka sendiri (tree_id orang: utama; hubungan: pohon asal)
  anakAsal('ou1', 'jaya')
  asal('hari', 'Hari', 'L', 1945)
  nikahAsal('ou7', 'ratna', 'hari')
  asal('eko', 'Eko', 'L', 1972)
  anakAsal('ou7', 'eko')

  // Orang di pohon asal yang tidak terhubung ke Eka.
  asal('asing', 'Asing', 'L', 1900)

  // ── Pohon keluarga asal Dara (pasangan khusus B) ─────────────────
  asal2('kromo', 'Kromo', 'L', 1925, { is_deceased: true, death_y: 1999 })
  asal2('painem', 'Painem', 'P', 1928, { is_deceased: true, death_y: 2005 })
  nikahAsal2('ov1', 'kromo', 'painem')
  asal2('sarno', 'Sarno', 'L', 1948)
  asal2('sastro', 'Sastro', 'L', 1950)
  anakAsal2('ov1', 'sarno')
  anakAsal2('ov1', 'sastro')
  asal2('wiji', 'Wiji', 'P', 1953)
  nikahAsal2('ov2', 'sastro', 'wiji')
  anakAsal2('ov2', 'dara') // Dara sendiri (orang: silsilah utama; hubungan: pohon asal)
  asal2('wulan', 'Wulan', 'P', 1981)
  anakAsal2('ov2', 'wulan')

  hitungUrutanLahir(data, tanpaUrutan)
  return data
}

// Mengisi birth_ranks seperti trigger database (003): per orang tua, di
// antara semua anaknya lintas pernikahan, menurut tahun lahir (yang tidak
// diketahui di akhir). Orang tua yang mendapat urutan: partner1 selalu;
// partner2 hanya kalau keturunan (silsilah utama) atau di pohon asal.
function hitungUrutanLahir(data, tanpaUrutan) {
  const orang = new Map(data.people.map((p) => [p.id, p]))
  const pangkal = data.unions.find((u) => u.id === data.root_union_id)
  const keturunan = new Set([pangkal.partner1_id, pangkal.partner2_id])
  for (const c of data.children) if (c.tree_id === null) keturunan.add(c.child_id)

  const perOrangTua = new Map()
  for (const c of data.children) {
    const u = data.unions.find((x) => x.id === c.union_id)
    const ortu = [u.partner1_id]
    if (u.partner2_id && (u.tree_id !== null || keturunan.has(u.partner2_id))) ortu.push(u.partner2_id)
    for (const p of ortu) {
      if (!perOrangTua.has(p)) perOrangTua.set(p, [])
      perOrangTua.get(p).push({ child: c.child_id, tree: u.tree_id })
    }
  }
  for (const [p, daftar] of perOrangTua) {
    const urut = [...daftar].sort(
      (a, b) => (orang.get(a.child).birth_y ?? Infinity) - (orang.get(b.child).birth_y ?? Infinity)
    )
    urut.forEach((d, i) => {
      if (tanpaUrutan.has(d.child)) return
      data.birth_ranks.push({ tree_id: d.tree, parent_id: p, child_id: d.child, rank: i + 1 })
    })
  }
}
