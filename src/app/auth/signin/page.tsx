'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const errorParam = searchParams.get('error')

  useEffect(() => {
    // Check if already signed in
    getSession().then((session) => {
      if (session) {
        router.push(callbackUrl)
      }
    })

    // Handle URL error parameters
    if (errorParam) {
      switch (errorParam) {
        case 'CredentialsSignin':
          setError('Felaktiga inloggningsuppgifter')
          break
        case 'AccessDenied':
          setError('Åtkomst nekad - kontakta administratör')
          break
        default:
          setError('Ett fel uppstod vid inloggning')
      }
    }
  }, [callbackUrl, errorParam, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Felaktiga inloggningsuppgifter')
      } else if (result?.ok) {
        // Get the updated session to check user role
        const updatedSession = await getSession()
        if (updatedSession?.user?.role === 'ADMIN') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Sign in error:', error)
      setError('Ett tekniskt fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center relative">
          <div className="absolute top-0 right-0">
            <ThemeToggle />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">ProffsKontakt</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Provisionssystem för solcellsförsäljning
          </p>
        </div>

        {/* Sign In Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Logga in
            </CardTitle>
            <CardDescription>
              Ange dina uppgifter för att komma åt systemet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-postadress</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@email.se"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Lösenord</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ditt lösenord"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !email || !password}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Loggar in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Logga in
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Login - iOS Style Profile Buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900 dark:text-white">Snabbinloggning</CardTitle>
            <CardDescription className="text-xs text-gray-600 dark:text-gray-300">
              Välj en profil för att logga in
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            <div className="flex gap-4 overflow-x-auto pb-8 pt-2 px-2">
              {/* Admin */}
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@proffskontakt.se')
                  setPassword('admin123')
                }}
                className="flex flex-col items-center gap-2 group min-w-fit"
                disabled={isLoading}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl">
                  A
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Admin</span>
              </button>

              {/* Manager */}
              <button
                type="button"
                onClick={() => {
                  setEmail('manager@proffskontakt.se')
                  setPassword('manager123')
                }}
                className="flex flex-col items-center gap-2 group min-w-fit"
                disabled={isLoading}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl">
                  M
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Manager</span>
              </button>

              {/* Frank Omsén */}
              <button
                type="button"
                onClick={() => {
                  setEmail('frank.omsen@proffskontakt.se')
                  setPassword('setter123')
                }}
                className="flex flex-col items-center gap-2 group min-w-fit"
                disabled={isLoading}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl">
                  FO
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Frank</span>
              </button>

              {/* Carl Brun */}
              <button
                type="button"
                onClick={() => {
                  setEmail('carl.brun@proffskontakt.se')
                  setPassword('setter123')
                }}
                className="flex flex-col items-center gap-2 group min-w-fit"
                disabled={isLoading}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl">
                  CB
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Carl</span>
              </button>

              {/* Gustaf Linder */}
              <button
                type="button"
                onClick={() => {
                  setEmail('gustaf.linder@proffskontakt.se')
                  setPassword('setter123')
                }}
                className="flex flex-col items-center gap-2 group min-w-fit"
                disabled={isLoading}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl">
                  GL
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Gustaf</span>
              </button>

              {/* Moltas Roslund */}
              <button
                type="button"
                onClick={() => {
                  setEmail('moltas.roslund@proffskontakt.se')
                  setPassword('setter123')
                }}
                className="flex flex-col items-center gap-2 group min-w-fit"
                disabled={isLoading}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl">
                  MR
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Moltas</span>
              </button>

              {/* Erik Andersson */}
              <button
                type="button"
                onClick={() => {
                  setEmail('erik.andersson@proffskontakt.se')
                  setPassword('setter123')
                }}
                className="flex flex-col items-center gap-2 group min-w-fit"
                disabled={isLoading}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl">
                  EA
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Erik</span>
              </button>

              {/* Lisa Andersson */}
              <button
                type="button"
                onClick={() => {
                  setEmail('lisa.andersson@proffskontakt.se')
                  setPassword('setter123')
                }}
                className="flex flex-col items-center gap-2 group min-w-fit"
                disabled={isLoading}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl">
                  LA
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Lisa</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          <p>© 2024 ProffsKontakt. Alla rättigheter förbehållna.</p>
          <p className="mt-1">
            Behöver du hjälp? Kontakta{' '}
            <a href="mailto:julian@proffskontakt.se" className="text-gray-900 dark:text-white hover:underline">
              julian@proffskontakt.se
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}