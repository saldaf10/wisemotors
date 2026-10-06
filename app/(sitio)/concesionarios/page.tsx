import type { Metadata } from 'next';
import { listarConcesionarios } from '@/lib/data/concesionarios';
import { ListaConcesionarios } from '@/components/concesionarios/ListaConcesionarios';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Concesionarios',
  description: 'Los concesionarios de carros nuevos en WiseMotors: dónde quedan, a cuántos km estás, horarios y los carros que venden.',
};

export default async function ConcesionariosPage() {
  const lista = await listarConcesionarios();
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-20 pt-10 md:px-8 md:pt-14">
      <h1 className="t-titulo text-[44px] md:text-[72px]">
        Concesionarios. <span className="text-tinta-2/50">Dónde verlo en persona.</span>
      </h1>
      <p className="mt-4 max-w-[640px] text-[16px] text-tinta-2">Dónde quedan, a cuántos km estás, su horario y los carros que venden.</p>
      <div className="mt-8">
        <ListaConcesionarios lista={lista} />
      </div>
    </div>
  );
}
