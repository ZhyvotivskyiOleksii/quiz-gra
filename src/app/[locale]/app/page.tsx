import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BrainCircuit } from "lucide-react";

export default function AppDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full -mt-14">
        <Card className="w-full max-w-2xl text-center shadow-xl animate-fade-in-up">
            <CardHeader>
                <BrainCircuit className="w-16 h-16 mx-auto text-primary" />
                <CardTitle className="text-3xl font-headline mt-4">Gotowy na wyzwanie?</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                    Rozpocznij szybki quiz składający się z 6 pytań - 3 historycznych i 3 predykcyjnych.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button size="lg" className="w-full sm:w-auto shadow-lg hover:shadow-primary/50 transition-shadow">
                    Rozpocznij szybki quiz <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
