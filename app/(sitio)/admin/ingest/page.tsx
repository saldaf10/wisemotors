import { SubidaGuia } from '@/components/admin/SubidaGuia';

// ?base=<id>: subir una versión nueva de ese carro (lo que la guía no traiga se toma de él).
export default function IngestPage({ searchParams }: { searchParams: { base?: string } }) {
  const baseId = typeof searchParams.base === 'string' && searchParams.base ? searchParams.base : undefined;
  return (
    <div className="min-h-screen px-5 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="t-titulo mb-3 text-[44px] md:text-[64px]">{baseId ? 'Subir versión nueva' : 'Subir vehículos'}</h1>
          <p className="text-tinta-2">
            {baseId ? 'Pega la guía de la versión nueva: lo que no traiga se toma de la versión base.' : 'Copia la plantilla del carro, llénala con la ficha técnica y pégala aquí.'}
          </p>
        </div>
        <SubidaGuia key={baseId ?? 'nuevo'} baseId={baseId} />
      </div>
    </div>
  );
}
