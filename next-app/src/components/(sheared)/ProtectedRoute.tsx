"use client"

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  role?: string
}

const ProtectedRoute = ({ children, role }: ProtectedRouteProps) => {
  const { user, loading, openAuthModal } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/')
      } else if (role) {
        const allowedRoles = role.split("|")
        if (!allowedRoles.includes(user.role)) {
          router.replace('/unauthorize')
        }
      }
    }
  }, [user, loading, role, router])

  if (loading || !user || (role && !role.split("|").includes(user.role))) {
    return (
      <div className="fixed inset-0 bg-white/0 backdrop-blur-sm flex items-center justify-center z-[1199]">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return <>{children}</>
}

export default ProtectedRoute
