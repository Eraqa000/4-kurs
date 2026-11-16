import { BrowserRouter, useRoutes } from 'react-router-dom'
import { Providers } from './Providers'
import { routes } from './routes'

function AppRoutes() {
  return useRoutes(routes)
}

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  )
}
