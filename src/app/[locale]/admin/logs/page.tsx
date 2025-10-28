'use client';
import { useState } from 'react';
import { analyzeAuditLogs } from '@/ai/flows/analyze-audit-logs-for-threats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Loader2, ShieldAlert } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const exampleLogs = `[2024-08-01 10:00:01] INFO: User 'admin@example.com' logged in from IP 192.168.1.10.
[2024-08-01 10:02:30] INFO: User 'user1@example.com' started game session 123.
[2024-08-01 10:05:00] WARN: User 'user2@example.com' failed login attempt from IP 203.0.113.5.
[2024-08-01 10:05:05] WARN: User 'user2@example.com' failed login attempt from IP 203.0.113.5.
[2024-08-01 10:05:10] WARN: User 'user2@example.com' failed login attempt from IP 203.0.113.5.
[2024-08-01 10:05:15] WARN: User 'user2@example.com' failed login attempt from IP 203.0.113.5.
[2024-08-01 10:05:20] ERROR: Too many failed login attempts for user 'user2@example.com'. Account locked.
[2024-08-01 10:10:00] INFO: Admin 'admin@example.com' updated question ID 45.
[2024-08-01 10:15:22] INFO: User 'user3@example.com' registered with phone +48555111222.
[2024-08-01 10:15:30] INFO: OTP requested for phone +48555111222 multiple times in a short period. IP: 10.0.0.5
[2024-08-01 10:15:31] INFO: OTP requested for phone +48555111222 multiple times in a short period. IP: 10.0.0.5
[2024-08-01 10:15:32] INFO: OTP requested for phone +48555111222 multiple times in a short period. IP: 10.0.0.5
`;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState(exampleLogs);
  const [analysis, setAnalysis] = useState<{ threatsIdentified: string[]; insights: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeAuditLogs({ auditLogs: logs });
      setAnalysis(result);
    } catch (e) {
      setError('Wystąpił błąd podczas analizy logów.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analiza logów audytowych</CardTitle>
          <CardDescription>
            Wklej logi audytowe do analizy, aby zidentyfikować potencjalne zagrożenia bezpieczeństwa. Silnik AI przeanalizuje dane i przedstawi wnioski.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              value={logs}
              onChange={(e) => setLogs(e.target.value)}
              rows={15}
              placeholder="Wklej tutaj logi do analizy..."
              className="font-code"
            />
            <Button onClick={handleAnalyze} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizowanie...
                </>
              ) : (
                'Analizuj logi'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Błąd</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Wyniki analizy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2"><ShieldAlert className="text-destructive"/> Zidentyfikowane zagrożenia</h3>
              {analysis.threatsIdentified.length > 0 ? (
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  {analysis.threatsIdentified.map((threat, index) => (
                    <li key={index}>{threat}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground mt-2">Nie zidentyfikowano żadnych bezpośrednich zagrożeń.</p>
              )}
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2"><Lightbulb className="text-yellow-500" /> Wnioski i rekomendacje</h3>
              <p className="text-muted-foreground mt-2 whitespace-pre-wrap">{analysis.insights}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
