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
//
//   Pohon keluarga asal Eka ("T1"): orang tuanya, saudaranya, Mbah, Mbah
//   buyut, Pakdhe/Budhe/Paklik/Bulik, sepupu, keponakan, dan satu paman
//   yang urutan lahirnya tidak diketahui.

export function bangunKeluargaFiktif() {
  const data = {
    people: [],
    unions: [],
    children: [],
    birth_ranks: [],
    origin_trees: [{ id: 'T1', anchor_person_id: 'eka', is_active: true }],
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
