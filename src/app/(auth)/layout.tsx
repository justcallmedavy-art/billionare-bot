export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-2 bg-redbar" />
      <div className="absolute inset-0 anim-grid pointer-events-none opacity-70" />
      <div className="relative w-full max-w-[430px]">{children}</div>
    </div>
  );
}
