'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function SystemLogsPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Systemhändelser Idag</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,429</div>
            <p className="text-xs text-muted-foreground">Normalt aktivitetsnivå</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Anrop</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.2%</div>
            <p className="text-xs text-muted-foreground">framgångsrika anrop</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fel & Varningar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">senaste 24 timmarna</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Genomsnittlig Svarstid</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">245ms</div>
            <p className="text-xs text-muted-foreground">Mycket bra prestanda</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Systemloggar & Aktivitet</CardTitle>
          <CardDescription>
            Övervaka systemhälsa och felsök problem i realtid
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">API Health Check - OK</p>
                <p className="text-xs text-gray-600">Alla externa tjänster svarar normalt</p>
              </div>
              <span className="text-xs text-gray-400">14:35</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg">
              <Activity className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Webhook Received</p>
                <p className="text-xs text-gray-600">Pipedrive deal update - Deal #1247</p>
              </div>
              <span className="text-xs text-gray-400">14:32</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Rate Limit Warning</p>
                <p className="text-xs text-gray-600">Adversus API närmar sig rate limit</p>
              </div>
              <span className="text-xs text-gray-400">14:28</span>
            </div>

            <div className="text-center py-8">
              <Badge variant="outline" className="mb-4">
                Under utveckling
              </Badge>
              <p className="text-muted-foreground">
                Utökad logghantering och realtidsövervakning kommer snart.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}