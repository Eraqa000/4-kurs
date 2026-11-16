import type { RouteObject } from 'react-router-dom'
import { CreatePage } from '../features/create/CreatePage'
import { GalleryPage } from '../features/gallery/GalleryPage'
import { MaterialPage } from '../features/gallery/MaterialPage'
import { LessonPage } from '../features/lessons/LessonPage'
import { LessonsPage } from '../features/lessons/LessonsPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { Layout } from './Layout'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <CreatePage /> },
      { path: '/gallery', element: <GalleryPage /> },
      { path: '/gallery/:id', element: <MaterialPage /> },
      { path: '/lessons', element: <LessonsPage /> },
      { path: '/lessons/:id', element: <LessonPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]
