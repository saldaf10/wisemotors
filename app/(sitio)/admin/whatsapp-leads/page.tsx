import { WhatsAppLeadsTable } from '@/components/admin/WhatsAppLeadsTable';

export default function WhatsAppLeadsPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-20 pt-10 md:px-8 md:pt-14">
      <a href="/admin" className="text-[14px] text-tinta-2 hover:text-tinta">← Panel</a>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-8">
        <h1 className="t-titulo text-[40px] md:text-[64px]">Leads de WhatsApp</h1>
        <p className="max-w-[44ch] text-[15px] text-tinta-2">
          Cada persona que pidió una prueba de manejo desde una ficha. Cambia su estado a medida que el concesionario la atiende y exporta la lista a Excel.
        </p>
      </div>
      <div className="mt-8">
        <WhatsAppLeadsTable />
      </div>
    </div>
  );
}
