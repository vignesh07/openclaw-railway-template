import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mission Control UI',
  description: 'Internal UI for the Threads pipeline',
};

const nav = [
  { href: '/', label: 'Inbox' },
  { href: '/sources', label: 'Sources' },
  { href: '/queue', label: 'Queue' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div>
              <p className="eyebrow">Internal</p>
              <h1>Mission Control</h1>
              <p className="muted">Threads review + queue visibility</p>
            </div>
            <nav className="nav">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="navLink">
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
