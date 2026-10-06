import { IngestStudio } from '@/components/admin/IngestStudio';

export default function IngestPage() {
  return (
    <div className="min-h-screen px-5 py-10 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="t-titulo mb-3 text-[44px] md:text-[64px]">Subir vehículos con IA</h1>
          <p className="text-tinta-2">Escribe el nombre del carro: la IA trae los datos para Colombia y tú solo verificas.</p>
        </div>
        <IngestStudio />
      </div>
    </div>
  );
}
