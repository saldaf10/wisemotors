import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

// El sitio completo, con menú y pie. La página de espera (app/espera) queda
// por fuera de este grupo para mostrarse sola mientras dura la expectativa.
export default function SitioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
