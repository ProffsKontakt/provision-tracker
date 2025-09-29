'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings, Database, Shield, Bell } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Connections</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2/2</div>
            <p className="text-xs text-muted-foreground">Adversus & Pipedrive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Mappings</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">konfigurerade setters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">aktiva endpoints</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.7%</div>
            <p className="text-xs text-muted-foreground">uptime denna månad</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>API Konfiguration</CardTitle>
            <CardDescription>
              Hantera anslutningar till externa tjänster
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Adversus API</div>
                <div className="text-sm text-gray-600">Samtalsdata och agent-metriker</div>
              </div>
              <Badge className="bg-green-100 text-green-800">Ansluten</Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Pipedrive API</div>
                <div className="text-sm text-gray-600">CRM deals och pipeline-data</div>
              </div>
              <Badge className="bg-green-100 text-green-800">Ansluten</Badge>
            </div>

            <Button variant="outline" className="w-full">
              Konfigurera API-nycklar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provision & Affärslogik</CardTitle>
            <CardDescription>
              Justera svenska solcells-provisions regler
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Base bonus per deal:</span>
                <strong>100 SEK</strong>
              </div>
              <div className="flex justify-between">
                <span>Offert commission:</span>
                <strong>100 SEK</strong>
              </div>
              <div className="flex justify-between">
                <span>Platsbesök commission:</span>
                <strong>300 SEK</strong>
              </div>
              <div className="flex justify-between">
                <span>Kreditfönster:</span>
                <strong>14 dagar</strong>
              </div>
            </div>

            <Button variant="outline" className="w-full">
              Redigera Provisions-regler
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Systemkonfiguration</CardTitle>
          <CardDescription>
            Avancerade inställningar och administrativa funktioner
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Badge variant="outline" className="mb-4">
              Under utveckling
            </Badge>
            <p className="text-muted-foreground">
              Denna sida kommer att innehålla fullständig systemkonfiguration,
              användarhantering, backup-inställningar och säkerhetskonfiguration.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}