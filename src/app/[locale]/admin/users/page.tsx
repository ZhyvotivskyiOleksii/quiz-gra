import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function UsersPage() {
  const users = [
    { id: 'usr_1', name: 'Jan Kowalski', email: 'jan.kowalski@example.com', role: 'user', status: 'active', lastLogin: '2024-08-01' },
    { id: 'usr_2', name: 'Anna Nowak', email: 'anna.nowak@example.com', role: 'user', status: 'active', lastLogin: '2024-07-31' },
    { id: 'usr_3', name: 'Admin', email: 'admin@example.com', role: 'admin', status: 'active', lastLogin: '2024-08-01' },
    { id: 'usr_4', name: 'Piotr Zieliński', email: 'piotr.zielinski@example.com', role: 'user', status: 'banned', lastLogin: '2024-07-20' },
  ];

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Zarządzanie użytkownikami</CardTitle>
                <CardDescription>Przeglądaj, wyszukuj i zarządzaj kontami użytkowników.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="pb-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Wyszukaj użytkownika po email lub nazwisku..." className="pl-8" />
                  </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Użytkownik</TableHead>
                            <TableHead>Rola</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ostatnie logowanie</TableHead>
                            <TableHead><span className="sr-only">Akcje</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="hidden h-9 w-9 sm:flex">
                                            <AvatarImage data-ai-hint="person face" src={`https://picsum.photos/seed/${user.id}/36/36`} alt={user.name} />
                                            <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                        </Avatar>
                                        <div className="grid gap-0.5">
                                            <p className="font-medium">{user.name}</p>
                                            <p className="text-sm text-muted-foreground">{user.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.status === 'banned' ? 'destructive' : 'outline'}>{user.status}</Badge>
                                </TableCell>
                                <TableCell>{user.lastLogin}</TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button aria-haspopup="true" size="icon" variant="ghost">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Akcje</DropdownMenuLabel>
                                      <DropdownMenuItem>Zmień rolę na admin</DropdownMenuItem>
                                      <DropdownMenuItem>Resetuj hasło</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive">Zablokuj użytkownika</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
