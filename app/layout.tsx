import type { Metadata } from 'next';
import { SocketProvider } from '@/lib/context/SocketContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'VideoMeet - Video Chat Application',
  description: 'Connect with anyone, anywhere through high-quality video calls',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
