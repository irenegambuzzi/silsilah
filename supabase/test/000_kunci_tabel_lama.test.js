// File 000 sudah dijalankan di project asli. Tes ini memastikan isinya
// tetap benar kalau suatu saat perlu dijalankan ulang.
import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { baris, buatDatabase, FOLDER_SQL, sebagai } from './tiruan-supabase.js'

const SQL = fs.readFileSync(path.join(FOLDER_SQL, '000_kunci_tabel_lama.sql'), 'utf8')
let db

beforeAll(async () => {
  db = await buatDatabase()
  // Meniru keadaan lama: tabel terbuka untuk publik, ada di Realtime.
  await db.exec(`
    create table public.family_tree (id serial primary key, data jsonb);
    insert into public.family_tree (data) values ('{"contoh": true}');
    alter table public.family_tree enable row level security;
    create policy "akses_publik" on public.family_tree for all using (true) with check (true);
    grant all on public.family_tree to anon, authenticated;
    grant all on sequence public.family_tree_id_seq to anon, authenticated;
    alter publication supabase_realtime add table public.family_tree;
  `)
}, 30000)

const hasilPemeriksaan = async () => {
  const hasil = await db.exec(SQL)
  return hasil.at(-1).rows
}

describe('000_kunci_tabel_lama.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan dua kali', async () => {
    for (let i = 0; i < 2; i++) {
      for (const r of await hasilPemeriksaan()) {
        if (r.harus === '1 atau lebih') expect(Number(r.hasil)).toBeGreaterThanOrEqual(1)
        else expect(r.hasil, r.pemeriksaan).toBe(r.harus)
      }
    }
  })

  it('anon tidak bisa lagi membaca atau menimpa data, tapi datanya tetap ada', async () => {
    await expect(sebagai(db, 'anon', {}, (tx) => baris(tx, 'select * from public.family_tree'))).rejects.toThrow(/permission denied/)
    await expect(
      sebagai(db, 'anon', {}, (tx) => tx.query(`update public.family_tree set data = '{}'`))
    ).rejects.toThrow(/permission denied/)
    const [r] = await baris(db, `select data from public.family_tree`)
    expect(r.data).toEqual({ contoh: true })
  })
})
