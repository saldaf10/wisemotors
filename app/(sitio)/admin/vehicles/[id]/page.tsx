import { EditorVehiculo } from '@/components/admin/EditorVehiculo';

// Ver y editar un carro publicado es la misma pantalla: el editor construido
// sobre el registro de atributos (el formulario viejo de 200 campos ya no existe).
export default function EditarVehiculoPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-20 pt-10 md:px-8 md:pt-14">
      <a href="/admin" className="text-[14px] text-tinta-2 hover:text-tinta">
        ← Panel
      </a>
      <EditorVehiculo vehicleId={params.id} />
    </div>
  );
}
