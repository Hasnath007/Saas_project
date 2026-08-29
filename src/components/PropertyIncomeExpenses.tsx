import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PropertyIncomeExpensesProps {
  propertyId: string;
}

interface Unit {
  id: string;
  unit_number: string;
}

interface IncomeEntry {
  id: string;
  category: string;
  amount: number;
  frequency: string;
  description: string | null;
  unit_id: string | null;
}

interface ExpenseEntry {
  id: string;
  category: string;
  amount: number;
  frequency: string;
  description: string | null;
  unit_id: string | null;
}

const INCOME_CATEGORIES = [
  "Rent",
  "Garage",
  "Parking",
  "Miscellaneous",
];

const EXPENSE_CATEGORIES = [
  "Taxes",
  "Insurance",
  "Hydro",
  "Gas/Propane/Oil",
  "Hot Water Tank",
  "Snow/Yard",
  "Water/Sewer",
  "Common Utilities",
  "Miscellaneous",
  "Maintenance",
  "Property Management",
  "Vacancy - Residential",
];

const FREQUENCIES = [
  { value: "one_time", label: "One Time" },
  { value: "monthly", label: "Monthly" },
  { value: "annually", label: "Annually" },
  { value: "quarterly", label: "Quarterly" },
];

export const PropertyIncomeExpenses = ({ propertyId }: PropertyIncomeExpensesProps) => {
  const { toast } = useToast();
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  
  // Form states
  const [incomeForm, setIncomeForm] = useState({
    category: "",
    amount: "",
    frequency: "one_time",
    description: "",
    unit_id: "",
  });
  
  const [expenseForm, setExpenseForm] = useState({
    category: "",
    amount: "",
    frequency: "one_time",
    description: "",
    unit_id: "",
  });

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [incomeRes, expenseRes, unitsRes] = await Promise.all([
        supabase
          .from("property_income")
          .select("*")
          .eq("property_id", propertyId)
          .order("category"),
        supabase
          .from("property_expenses")
          .select("*")
          .eq("property_id", propertyId)
          .order("category"),
        supabase
          .from("units")
          .select("id, unit_number")
          .eq("property_id", propertyId)
          .order("unit_number"),
      ]);
      
      if (incomeRes.error) throw incomeRes.error;
      if (expenseRes.error) throw expenseRes.error;
      if (unitsRes.error) throw unitsRes.error;
      
      setIncomeEntries(incomeRes.data || []);
      setExpenseEntries(expenseRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load income and expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const convertToMonthly = (amount: number, frequency: string): number => {
    switch (frequency) {
      case "one_time":
        return 0; // One-time payments don't contribute to monthly recurring
      case "annually":
        return amount / 12;
      case "quarterly":
        return amount / 3;
      default:
        return amount;
    }
  };

  const calculateTotals = (entries: (IncomeEntry | ExpenseEntry)[]) => {
    const monthly = entries.reduce((sum, entry) => {
      return sum + convertToMonthly(Number(entry.amount), entry.frequency);
    }, 0);
    return {
      monthly,
      annually: monthly * 12,
    };
  };

  const incomeTotals = calculateTotals(incomeEntries);
  const expenseTotals = calculateTotals(expenseEntries);
  const netIncome = {
    monthly: incomeTotals.monthly - expenseTotals.monthly,
    annually: incomeTotals.annually - expenseTotals.annually,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };


  const handleSaveIncome = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      if (editingIncome) {
        const { error } = await supabase
          .from("property_income")
          .update({
            category: incomeForm.category,
            amount: parseFloat(incomeForm.amount),
            frequency: incomeForm.frequency,
            description: incomeForm.description || null,
            unit_id: incomeForm.unit_id || null,
          })
          .eq("id", editingIncome.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("property_income")
          .insert({
            property_id: propertyId,
            user_id: userData.user.id,
            category: incomeForm.category,
            amount: parseFloat(incomeForm.amount),
            frequency: incomeForm.frequency,
            description: incomeForm.description || null,
            unit_id: incomeForm.unit_id || null,
          });
        
        if (error) throw error;
      }

      toast({ title: "Success", description: "Income saved successfully" });
      setIncomeDialogOpen(false);
      setEditingIncome(null);
      setIncomeForm({ category: "", amount: "", frequency: "one_time", description: "", unit_id: "" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save income",
        variant: "destructive",
      });
    }
  };

  const handleSaveExpense = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      if (editingExpense) {
        const { error } = await supabase
          .from("property_expenses")
          .update({
            category: expenseForm.category,
            amount: parseFloat(expenseForm.amount),
            frequency: expenseForm.frequency,
            description: expenseForm.description || null,
            unit_id: expenseForm.unit_id || null,
          })
          .eq("id", editingExpense.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("property_expenses")
          .insert({
            property_id: propertyId,
            user_id: userData.user.id,
            category: expenseForm.category,
            amount: parseFloat(expenseForm.amount),
            frequency: expenseForm.frequency,
            description: expenseForm.description || null,
            unit_id: expenseForm.unit_id || null,
          });
        
        if (error) throw error;
      }

      toast({ title: "Success", description: "Expense saved successfully" });
      setExpenseDialogOpen(false);
      setEditingExpense(null);
      setExpenseForm({ category: "", amount: "", frequency: "one_time", description: "", unit_id: "" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save expense",
        variant: "destructive",
      });
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!confirm("Delete this income entry?")) return;
    
    try {
      const { error } = await supabase
        .from("property_income")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Income deleted" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete income",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Delete this expense entry?")) return;
    
    try {
      const { error } = await supabase
        .from("property_expenses")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Expense deleted" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    }
  };

  const openEditIncome = (entry: IncomeEntry) => {
    setEditingIncome(entry);
    setIncomeForm({
      category: entry.category,
      amount: entry.amount.toString(),
      frequency: entry.frequency,
      description: entry.description || "",
      unit_id: entry.unit_id || "",
    });
    setIncomeDialogOpen(true);
  };

  const openEditExpense = (entry: ExpenseEntry) => {
    setEditingExpense(entry);
    setExpenseForm({
      category: entry.category,
      amount: entry.amount.toString(),
      frequency: entry.frequency,
      description: entry.description || "",
      unit_id: entry.unit_id || "",
    });
    setExpenseDialogOpen(true);
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading income and expenses...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Income Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-success" />
              Residential Income
            </CardTitle>
            <Dialog open={incomeDialogOpen} onOpenChange={(open) => {
              setIncomeDialogOpen(open);
              if (!open) {
                setEditingIncome(null);
                setIncomeForm({ category: "", amount: "", frequency: "one_time", description: "", unit_id: "" });
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingIncome ? "Edit Income" : "Add Income"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select 
                      value={incomeForm.category} 
                      onValueChange={(v) => setIncomeForm({ ...incomeForm, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {INCOME_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {units.length > 0 && (
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select 
                        value={incomeForm.unit_id} 
                        onValueChange={(v) => setIncomeForm({ ...incomeForm, unit_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              Unit {unit.unit_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={incomeForm.amount}
                      onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select 
                      value={incomeForm.frequency} 
                      onValueChange={(v) => setIncomeForm({ ...incomeForm, frequency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Input
                      placeholder="Add notes..."
                      value={incomeForm.description}
                      onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIncomeDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveIncome}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {incomeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No income entries yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Freq.</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(entry.amount))}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{entry.frequency}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditIncome(entry)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteIncome(entry.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Total Income - Monthly</span>
              <span className="font-bold text-success">{formatCurrency(incomeTotals.monthly)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Total Income - Annually</span>
              <span className="font-bold text-success">{formatCurrency(incomeTotals.annually)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Expenses
            </CardTitle>
            <Dialog open={expenseDialogOpen} onOpenChange={(open) => {
              setExpenseDialogOpen(open);
              if (!open) {
                setEditingExpense(null);
                setExpenseForm({ category: "", amount: "", frequency: "one_time", description: "", unit_id: "" });
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select 
                      value={expenseForm.category} 
                      onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {units.length > 0 && (
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select 
                        value={expenseForm.unit_id} 
                        onValueChange={(v) => setExpenseForm({ ...expenseForm, unit_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              Unit {unit.unit_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select 
                      value={expenseForm.frequency} 
                      onValueChange={(v) => setExpenseForm({ ...expenseForm, frequency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Input
                      placeholder="Add notes..."
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveExpense}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {expenseEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No expense entries yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Freq.</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(entry.amount))}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{entry.frequency}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditExpense(entry)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteExpense(entry.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Total Expenses - Monthly</span>
              <span className="font-bold text-destructive">{formatCurrency(expenseTotals.monthly)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Total Expenses - Annually</span>
              <span className="font-bold text-destructive">{formatCurrency(expenseTotals.annually)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net Income Summary */}
      <Card className="lg:col-span-2">
        <CardContent className="p-6">
          <div className="flex flex-wrap justify-center gap-8">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Net Operating Income (Monthly)</p>
              <p className={`text-2xl font-bold ${netIncome.monthly >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(netIncome.monthly)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Net Operating Income (Annually)</p>
              <p className={`text-2xl font-bold ${netIncome.annually >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(netIncome.annually)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
