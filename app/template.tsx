// Re-mounts on every navigation, so content fades up 8px / 240ms on route enter.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
