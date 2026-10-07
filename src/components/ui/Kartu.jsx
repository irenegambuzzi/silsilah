export const Kartu = ({ children, className = '', ...sisa }) => (
  <section className={`rounded-2xl border-2 border-garis bg-kertas p-5 ${className}`} {...sisa}>
    {children}
  </section>
)
