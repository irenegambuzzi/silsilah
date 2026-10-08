// Klien tiruan yang sudah masuk dengan keluarga FIKTIF (keluargaFiktif.js)
// sebagai isi database, untuk tes layar Daftar, Detail, dan Bagan.
import { OK, klienSudahMasuk } from './klienTiruan.js'
import { bangunKeluargaFiktif } from '../lib/silsilah/keluargaFiktif.js'

export const keluargaFiktif = bangunKeluargaFiktif()

export const tabelKeluarga = (keluarga = keluargaFiktif) => ({
  people: structuredClone(keluarga.people),
  unions: structuredClone(keluarga.unions),
  children: structuredClone(keluarga.children),
  birth_ranks: structuredClone(keluarga.birth_ranks),
  origin_trees: structuredClone(keluarga.origin_trees),
  settings: [{ root_union_id: keluarga.root_union_id, generation_terms: null, temp_access_max_minutes: 1440 }],
})

export const klienKeluarga = (tambahan = {}) =>
  klienSudahMasuk({
    ...tambahan,
    rpc: { db_version: async () => OK('999'), sign_out_devices: async () => OK(1), ...(tambahan.rpc ?? {}) },
    tabel: { ...tabelKeluarga(), ...(tambahan.tabel ?? {}) },
  })
