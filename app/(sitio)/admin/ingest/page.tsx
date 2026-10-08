import { SubidaGuia } from '@/components/admin/SubidaGuia';

export default function IngestPage() {
  return (
    <div className="min-h-screen px-5 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="t-titulo mb-3 text-[44px] md:text-[64px]">Subir vehículos</h1>
          <p className="text-tinta-2">Copia la plantilla del carro, llénala con la ficha técnica y pégala aquí.</p>
        </div>
        <SubidaGuia />
      </div>
    </div>
  );
}
