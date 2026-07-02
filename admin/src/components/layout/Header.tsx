export function Header() {
  return (
    <header className="h-16 border-b border-border bg-card/30 backdrop-blur-sm">
      <div className="h-full px-6 flex items-center justify-between">
        <div />
        <div className="text-xs font-mono text-muted-foreground">
          {/* Chunk D: active mode switcher */}
          {/* Chunk B: user menu + logout */}
        </div>
      </div>
    </header>
  );
}
