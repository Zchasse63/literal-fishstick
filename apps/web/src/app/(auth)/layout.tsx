export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]">
      {children}
    </div>
  );
}
