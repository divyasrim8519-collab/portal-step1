import './globals.css';

export const metadata = { title: 'Craftory Portal', description: 'Confidential project communication' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
