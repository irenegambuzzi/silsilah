// Edge Function cek-perangkat (Deno, Supabase). Dipanggil aplikasi setiap
// kali dibuka, dengan header Authorization: Bearer <token login>.
//
// POST → { ok: true, status: 'ok' | 'dicabut' | 'kedaluwarsa' | 'tidak_terdaftar', berakhir }
//        atau 401 { ok: false, alasan: 'sesi_habis' }
// Perangkat/anggota yang sudah dicabut tetapi masih dibuka → admin utama
// langsung diberi tahu. Logika: ../_shared/cek-perangkat.js.
// Deploy: lihat README (verify_jwt mati; token diperiksa di dalam fungsi).

import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { buatPenanganCekPerangkat } from '../_shared/http.js'
import { buatAmbilLayanan, opsiDariEnv } from '../_shared/layanan.js'

Deno.serve(buatPenanganCekPerangkat(buatAmbilLayanan(createClient, Deno.env), opsiDariEnv(Deno.env)))
