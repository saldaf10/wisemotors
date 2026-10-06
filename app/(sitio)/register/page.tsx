import Link from 'next/link';
import { conDestino } from '@/lib/destino';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { AuthShell } from '@/components/auth/AuthShell';

export default function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <AuthShell
      titulo="Crea tu cuenta."
      tenue="Guarda, compara, decide."
      pie={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href={conDestino('/login', searchParams.next)} className="font-medium text-tinta underline-offset-4 hover:underline">
            Ingresar
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
