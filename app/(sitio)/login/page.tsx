import Link from 'next/link';
import { conDestino } from '@/lib/destino';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthShell } from '@/components/auth/AuthShell';

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <AuthShell
      titulo="Hola de nuevo."
      tenue="Tus favoritos te esperan."
      pie={
        <>
          ¿No tienes cuenta?{' '}
          <Link href={conDestino('/register', searchParams.next)} className="font-medium text-tinta underline-offset-4 hover:underline">
            Crear una
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
