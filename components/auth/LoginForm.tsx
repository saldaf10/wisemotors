'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loginSchema, type LoginInput } from '@/lib/schemas/auth';
import { useAuth } from '@/contexts/AuthContext';
import { destinoDeLaUrl } from '@/lib/destino';
import { recorridoAlIngresar } from '@/components/recorrido/Recorrido';

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginInput>({
    emailOrUsername: '',
    password: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar datos
      const validatedData = loginSchema.parse(formData);
      
      // Enviar login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedData),
      });

      const data = await response.json();

      if (response.ok) {
        // Login exitoso
        
        // El rol lo define el servidor (columna User.role); el cliente no lo deriva
        // del email ni lo puede ascender por su cuenta.
        login(data.user, data.token);
        
        // Esperar a que el estado se actualice
        await new Promise(resolve => setTimeout(resolve, 50));
        
        
        // Usar window.location.href para asegurar que la página se recargue
        // y el estado se sincronice correctamente. Vuelve a donde estaba
        // (ej. la comparación) si llegó con ?next=.
        // Las cuentas de prueba arrancan el recorrido cada vez: van al inicio.
        window.location.href = recorridoAlIngresar(data.user) ? '/' : destinoDeLaUrl();
      } else {
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        setError(error.errors[0]?.message || 'Datos inválidos');
      } else {
        setError('Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="emailOrUsername">Email o Nombre de usuario</Label>
          <Input
            id="emailOrUsername"
            name="emailOrUsername"
            type="text"
            value={formData.emailOrUsername}
            onChange={handleChange}
            required
            className="mt-1"
            placeholder="tu@email.com o tu_usuario"
          />
        </div>

        <div>
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative mt-1">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              required
              className="pr-10"
              placeholder="Tu contraseña"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </Button>
      </form>
    </div>
  );
}
