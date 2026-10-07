// Edge Function pakai-kode (Deno, Supabase): kode tambah perangkat atau
// kode akses sementara (8 karakter, 10 menit, sekali pakai).
//
// POST { kode } → { ok: true, token_hash, tiket, nama, via, menit }
//                atau { ok: false, alasan } (pesan: src/teks/id.js teks.masuk)
// Logika: ../_shared/penukaran.js. Pengaturan: ../_shared/layanan.js.
// Deploy: lihat README (verify_jwt mati, karena pemanggil belum login).

import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { buatPenangan } from '../_shared/http.js'
import { buatAmbilLayanan, opsiDariEnv } from '../_shared/layanan.js'

Deno.serve(buatPenangan('kode', buatAmbilLayanan(createClient, Deno.env), opsiDariEnv(Deno.env)))
