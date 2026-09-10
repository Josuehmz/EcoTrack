import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EcoTrack — huella de carbono en lenguaje natural',
  description:
    'Prototipo: escribe lo que hiciste hoy y EcoTrack estima tu huella de carbono del día.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
