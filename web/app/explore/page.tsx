import GraphExplorer from '@/components/GraphExplorer'

export const metadata = {
  title: 'Explorador del Corpus · Consejo de Ministros',
}

export default function ExplorePage() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 57px - 57px)' }}>
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-baseline justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Explorador del corpus legislativo
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Haga clic en cualquier nodo para ver sus relaciones y expandir su vecindario.
            </p>
          </div>
          <div className="text-xs text-slate-400 hidden md:block">
            Nodos: azul marino = en vigor · rojo = derogada · gris = sin ID BOE
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
