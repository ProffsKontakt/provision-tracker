'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  ChevronLeft,
  Save,
  LogOut,
  Key,
  Mail,
  Phone,
  Building,
  Users,
  Settings as SettingsIcon
} from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const [activeTab, setActiveTab] = useState('profile')
  const [isLoading, setIsLoading] = useState(false)

  if (!session) {
    return null
  }

  const isAdmin = session.user.role === 'ADMIN'
  const isManager = session.user.role === 'MANAGER'

  const handleSave = async () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      alert('Inställningar sparade!')
    }, 1000)
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inställningar</h1>
          <p className="text-gray-600 mt-1">
            Hantera ditt konto och systempreferenser
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {isLoading ? 'Sparar...' : 'Spara ändringar'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notiser</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Säkerhet</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Utseende</span>
          </TabsTrigger>
          {(isAdmin || isManager) && (
            <TabsTrigger value="system" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personlig information
              </CardTitle>
              <CardDescription>
                Uppdatera dina kontouppgifter och kontaktinformation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-16 h-16 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-gray-900 text-xl font-bold">
                  {session.user.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium">{session.user.name}</h3>
                  <p className="text-sm text-gray-600">{session.user.email}</p>
                  <Badge className="mt-1">{session.user.role}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Fullständigt namn</Label>
                  <Input id="name" defaultValue={session.user.name || ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opener">Opener namn</Label>
                  <Input id="opener" defaultValue={session.user.openerName || ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-postadress</Label>
                  <Input id="email" type="email" defaultValue={session.user.email || ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefonnummer</Label>
                  <Input id="phone" placeholder="070-123 45 67" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Arbetsinformation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Roll</Label>
                  <Input id="role" defaultValue={session.user.role} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Avdelning</Label>
                  <Select defaultValue="sales">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Försäljning</SelectItem>
                      <SelectItem value="admin">Administration</SelectItem>
                      <SelectItem value="management">Ledning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select defaultValue="stockholm">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stockholm">Stockholm</SelectItem>
                      <SelectItem value="goteborg">Göteborg</SelectItem>
                      <SelectItem value="malmo">Malmö</SelectItem>
                      <SelectItem value="national">Nationell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Startdatum</Label>
                  <Input id="startDate" type="date" defaultValue="2024-01-15" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifieringsinställningar
              </CardTitle>
              <CardDescription>
                Välj hur och när du vill få notiser
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notifications">E-postnotiser</Label>
                    <p className="text-sm text-gray-600">Få notiser via e-post</p>
                  </div>
                  <Switch id="email-notifications" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="commission-alerts">Provisionsvarningar</Label>
                    <p className="text-sm text-gray-600">Notiser när provision godkänns</p>
                  </div>
                  <Switch id="commission-alerts" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="lead-updates">Lead-uppdateringar</Label>
                    <p className="text-sm text-gray-600">Notiser om nya leads och statusändringar</p>
                  </div>
                  <Switch id="lead-updates" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="system-maintenance">Systemunderhåll</Label>
                    <p className="text-sm text-gray-600">Varningar om planerat underhåll</p>
                  </div>
                  <Switch id="system-maintenance" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="weekly-reports">Veckorapporter</Label>
                    <p className="text-sm text-gray-600">Automatiska rapporter varje måndag</p>
                  </div>
                  <Switch id="weekly-reports" defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Säkerhetsinställningar
              </CardTitle>
              <CardDescription>
                Hantera lösenord och säkerhetsfunktioner
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Nuvarande lösenord</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nytt lösenord</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Bekräfta nytt lösenord</Label>
                  <Input id="confirm-password" type="password" />
                </div>
                <Button className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Uppdatera lösenord
                </Button>
              </div>

              <div className="pt-6 border-t">
                <h4 className="font-medium mb-4">Säkerhetsfunktioner</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Tvåfaktorsautentisering (2FA)</Label>
                      <p className="text-sm text-gray-600">Extra säkerhetslager för ditt konto</p>
                    </div>
                    <Button variant="outline" size="sm">Aktivera</Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Inloggningshistorik</Label>
                      <p className="text-sm text-gray-600">Se senaste inloggningar</p>
                    </div>
                    <Button variant="outline" size="sm">Visa historik</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <LogOut className="h-5 w-5" />
                Logga ut
              </CardTitle>
              <CardDescription>
                Logga ut från alla enheter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertDescription>
                  Detta kommer logga ut dig från alla enheter där du är inloggad.
                </AlertDescription>
              </Alert>
              <Button variant="destructive" onClick={handleSignOut} className="mt-4">
                Logga ut överallt
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Utseende och språk
              </CardTitle>
              <CardDescription>
                Anpassa systemets utseende och språkinställningar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Select defaultValue="light">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Ljust tema</SelectItem>
                      <SelectItem value="dark">Mörkt tema</SelectItem>
                      <SelectItem value="auto">Automatiskt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Språk</Label>
                  <Select defaultValue="sv">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sv">Svenska</SelectItem>
                      <SelectItem value="en">Engelska</SelectItem>
                      <SelectItem value="no">Norska</SelectItem>
                      <SelectItem value="da">Danska</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tidzon</Label>
                  <Select defaultValue="stockholm">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stockholm">Stockholm (CET)</SelectItem>
                      <SelectItem value="london">London (GMT)</SelectItem>
                      <SelectItem value="new-york">New York (EST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Datumformat</Label>
                  <Select defaultValue="ddmmyyyy">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ddmmyyyy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="mmddyyyy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="yyyymmdd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab (Admin/Manager only) */}
        {(isAdmin || isManager) && (
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Systeminställningar
                </CardTitle>
                <CardDescription>
                  Konfigurationer för hela systemet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Provision</h4>
                    <div className="space-y-2">
                      <Label htmlFor="base-bonus">Grundbonus (SEK)</Label>
                      <Input id="base-bonus" defaultValue="100" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offert-rate">Offert provision (SEK)</Label>
                      <Input id="offert-rate" defaultValue="100" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="visit-rate">Platsbesök provision (SEK)</Label>
                      <Input id="visit-rate" defaultValue="300" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Affärsregler</h4>
                    <div className="space-y-2">
                      <Label htmlFor="credit-window">Kreditfönster (dagar)</Label>
                      <Input id="credit-window" defaultValue="14" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min-call">Min samtalslängd (sek)</Label>
                      <Input id="min-call" defaultValue="60" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-companies">Max bolag per lead</Label>
                      <Input id="max-companies" defaultValue="4" />
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-6 border-t">
                    <h4 className="font-medium mb-4">Användarhantering</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Button variant="outline" className="h-16 flex flex-col gap-1">
                        <Users className="h-5 w-5" />
                        <span className="text-xs">Hantera användare</span>
                      </Button>
                      <Button variant="outline" className="h-16 flex flex-col gap-1">
                        <Building className="h-5 w-5" />
                        <span className="text-xs">Företag</span>
                      </Button>
                      <Button variant="outline" className="h-16 flex flex-col gap-1">
                        <Shield className="h-5 w-5" />
                        <span className="text-xs">Behörigheter</span>
                      </Button>
                      <Button variant="outline" className="h-16 flex flex-col gap-1">
                        <Globe className="h-5 w-5" />
                        <span className="text-xs">Systemloggar</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Back to Dashboard */}
      <Card>
        <CardContent className="p-4">
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Tillbaka till Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}