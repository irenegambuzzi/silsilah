// Satu kartu di Bagan: GEN dan istilah Jawa, nama (dengan Alm./Almh. dan
// gelar), panggilan, tahun lahir–wafat, dan keterangan kecil ("Anak ke-6 ·
// dari istri ke-1" atau "Pasangan dari …"). Anak sambung dan angkat
// memakai kartu yang sama persis. Pasangan yang bukan keturunan bergaris putus-putus.
export function KartuOrang({ kartu, terpilih, saatKetuk }) {
  const pasangan = kartu.jenis === 'pasangan'
  return (
    <button
      type="button"
      data-orang={kartu.id}
      aria-pressed={terpilih}
      onClick={() => saatKetuk(kartu.id)}
      className={`flex min-h-[6rem] w-44 flex-col items-center gap-1 rounded-xl border-2 bg-kertas px-2 py-2 text-center ${
        pasangan ? 'border-dashed' : 'border-solid'
      } ${terpilih ? 'border-fokus outline-4 outline-fokus' : 'border-garis'}`}
    >
      {kartu.labelGen && (
        <span className="text-sm font-semibold leading-tight text-redup">
          {kartu.labelGen}
          {kartu.istilahGen ? ` · ${kartu.istilahGen}` : ''}
        </span>
      )}
      <span className="text-base font-bold leading-tight">{kartu.nama}</span>
      {kartu.panggilan && <span className="text-sm leading-tight">“{kartu.panggilan}”</span>}
      {kartu.tahun && <span className="text-sm leading-tight">{kartu.tahun}</span>}
      {kartu.keterangan && <span className="text-sm leading-tight text-redup">{kartu.keterangan}</span>}
    </button>
  )
}
