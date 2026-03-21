import "./globals.css";

export const metadata = {
  title: "OpenClaw Setup",
  description: "Minimal setup control surface for the Railway wrapper.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
