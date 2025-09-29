import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export default async function Home() {
  const session = await getServerSession(authOptions)

  console.log('🔍 Root page - Session:', !!session, 'Role:', session?.user?.role)

  if (session) {
    // Redirect admin users directly to admin panel
    if (session.user.role === 'ADMIN') {
      console.log('🔄 Root page redirecting ADMIN to /admin')
      redirect('/admin')
    } else {
      console.log('🔄 Root page redirecting non-admin to /dashboard')
      redirect('/dashboard')
    }
  } else {
    console.log('🔄 Root page redirecting unauthenticated to /auth/signin')
    redirect('/auth/signin')
  }
}
