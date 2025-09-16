import './globals.css';

export const metadata = {
  title: "VidAI Ultra Studio",
  description: "Pro-grade faceless video studio — MP4/WEBM, SRT, presets, brand kit, QR, PWA, strict-local by default.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr">Skip to content</a>
        {children}
        <script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}`}} />
      </body>
    </html>
  );
}
