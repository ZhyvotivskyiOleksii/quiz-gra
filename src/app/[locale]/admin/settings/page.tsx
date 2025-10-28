import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ustawienia</CardTitle>
          <CardDescription>
            Zarządzaj globalnymi ustawieniami aplikacji.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Limity OTP</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="otp-sms-limit">Limit SMS / 10 min</Label>
                <Input id="otp-sms-limit" type="number" defaultValue="3" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp-verify-limit">Limit weryfikacji / godzinę</Label>
                <Input id="otp-verify-limit" type="number" defaultValue="5" />
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Integracje SMS (np. Twilio)</h3>
            <div className="space-y-2">
              <Label htmlFor="twilio-sid">Account SID</Label>
              <Input id="twilio-sid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-token">Auth Token</Label>
              <Input id="twilio-token" type="password" placeholder="••••••••••••••••••••••" />
            </div>
          </div>
          <Button>Zapisz zmiany</Button>
        </CardContent>
      </Card>
    </div>
  );
}
