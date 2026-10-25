export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid flex-1 place-items-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-heading text-2xl font-semibold tracking-tight">
            Ajo<span className="text-primary">Desk</span>
          </p>
          <p className="text-sm text-muted-foreground">Daily thrift records for collectors</p>
        </div>
        {children}
      </div>
    </main>
  );
}
