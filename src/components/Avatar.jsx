// Avatar orang di panel keterangan: lingkaran berbingkai emas berisi emoji
// sesuai jenis kelamin, seperti aplikasi lama. SEMENTARA: di Fase 3 diganti
// foto anggota (`foto` = alamat sementara dari Storage privat; lihat
// PLAN.md, persyaratan keamanan foto). Emoji dan foto sama-sama hiasan,
// karena nama selalu tertulis di sebelahnya.
const EMOJI = { L: '👨', P: '👩' }

export function Avatar({ sex = null, foto = null, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`mx-auto flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emas bg-latar text-4xl ${className}`}
    >
      {foto ? <img src={foto} alt="" className="size-full object-cover" /> : (EMOJI[sex] ?? '🧑')}
    </div>
  )
}
