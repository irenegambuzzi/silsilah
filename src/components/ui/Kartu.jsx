// Kotak putih seperti aplikasi lama: sudut 12px, tepi tipis, bayangan halus,
// dan garis emas di tepi atas.
export const Kartu = ({ children, className = '', ...sisa }) => (
  <section
    className={`rounded-xl border border-t-[3px] border-tepi border-t-emas bg-kertas p-5 shadow-lembut ${className}`}
    {...sisa}
  >
    {children}
  </section>
)
