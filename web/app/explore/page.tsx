import GraphExplorer from '@/components/GraphExplorer'

export const metadata = {
  title: 'Explorador del corpus · Consejo de Ministros',
}

export default function ExplorePage() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 73px - 65px)' }}>
      {/* Page header */}
      <div className="border-b border-rule px-6 md:px-10 py-4 flex-shrink-0">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-serif text-lg text-ink">
              Explorador del corpus legislativo
            </h1>
            <p className="font-sans text-xs text-ink-faint mt-0.5">
              Vista inicial: las normas de mayor centralidad y las cuatro normas
              señaladas en los informes. Haga clic en cualquier nodo para ver sus
              relaciones y ampliar su vecindario.
            </p>
          </div>
        </div>
      </div>

      {/* Explorer (fills remaining height) */}
      <div className="flex-1 overflow-hidden">
        <GraphExplorer />
      </div>
    </div>
  )
}
