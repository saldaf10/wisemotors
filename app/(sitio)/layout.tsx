import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Recorrido } from '@/components/recorrido/Recorrido'
import { Encuesta } from '@/components/recorrido/Encuesta'
import { ExigirCuenta } from '@/components/auth/ExigirCuenta'
import { sitioAbierto } from '@/lib/acceso'

// El sitio completo, con menú y pie. La página de espera (app/espera) queda
// por fuera de este grupo para mostrarse sola mientras dura la expectativa.
export default function SitioLayout({ children }: { children: React.ReactNode }) {
  // Con el sitio cerrado (acceso por código), tener cuenta es obligatorio.
  return (
    <ExigirCuenta activo={!sitioAbierto()}>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Recorrido />
        <Encuesta />
      </div>
    </ExigirCuenta>
  )
}
