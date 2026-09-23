import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import SignInPage from '@/pages/auth/SignInPage'
import SignUpPage from '@/pages/auth/SignUpPage'
import { ChatLayout } from '@/components/chat/ChatLayout'
import ChatWelcomePage from '@/pages/chat/ChatWelcomePage'
import ChatThreadPage from '@/pages/chat/ChatThreadPage'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Document Copilot encountered an error">
      <BrowserRouter>

      <Routes>
        {/* Public auth routes */}
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />

        {/* Protected routes — redirect to /sign-in if no session */}
        <Route element={<ProtectedRoute />}>
          <Route element={<ChatLayout />}>
            <Route path="/" element={<ChatWelcomePage />} />
            <Route path="/chat/:threadId" element={<ChatThreadPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
</StrictMode>,

)
