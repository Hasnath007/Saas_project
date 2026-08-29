import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, DollarSign, Eye, Share2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  generateOwnerMonthlyStatement,
  generatePortfolioPerformanceSummary,
  generateTenantPaymentAnalysis,
  generateMaintenanceCostAnalysis,
  generateVacancyReport,
  generateYearEndTaxSummary,
} from "@/lib/reportGenerators";

const reportTemplates = [
  {
    icon: DollarSign,
    title: "Owner Monthly Statement",
    category: "Financial",
    description: "Comprehensive P&L breakdown with income, expenses, and cash flow analysis",
    lastGenerated: "Jan 14, 2024",
    recipients: "12 stakeholders",
    format: "PDF",
  },
  {
    icon: TrendingUp,
    title: "Portfolio Performance Summary",
    category: "Analytics",
    description: "Key metrics, ROI analysis, and property performance comparisons",
    lastGenerated: "Jan 9, 2024",
    recipients: "5 stakeholders",
    format: "PDF + Excel",
  },
  {
    icon: DollarSign,
    title: "Tenant Payment Analysis",
    category: "Financial",
    description: "Collection insights, payment patterns, and delinquency tracking",
    lastGenerated: "Jan 11, 2024",
    recipients: "3 stakeholders",
    format: "PDF",
  },
  {
    icon: FileText,
    title: "Maintenance Cost Analysis",
    category: "Operations",
    description: "Cost breakdown by property, category, and vendor performance",
    lastGenerated: "Jan 7, 2024",
    recipients: "8 stakeholders",
    format: "PDF + PowerPoint",
  },
  {
    icon: TrendingUp,
    title: "Vacancy Report",
    category: "Analytics",
    description: "Market comparisons, vacancy rates, and leasing performance",
    lastGenerated: "Jan 13, 2024",
    recipients: "6 stakeholders",
    format: "PDF",
  },
  {
    icon: DollarSign,
    title: "Year-End Tax Summary",
    category: "Financial",
    description: "Complete tax preparation documentation with supporting schedules",
    lastGenerated: "Dec 30, 2023",
    recipients: "15 stakeholders",
    format: "PDF + Excel",
  },
];

const Reports = () => {
  const handleGenerateReport = (index: number, title: string) => {
    try {
      switch (index) {
        case 0:
          generateOwnerMonthlyStatement();
          break;
        case 1:
          generatePortfolioPerformanceSummary();
          break;
        case 2:
          generateTenantPaymentAnalysis();
          break;
        case 3:
          generateMaintenanceCostAnalysis();
          break;
        case 4:
          generateVacancyReport();
          break;
        case 5:
          generateYearEndTaxSummary();
          break;
        default:
          break;
      }
      toast.success(`${title} generated successfully!`);
    } catch (error) {
      toast.error(`Failed to generate ${title}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Professional Reports</h1>
            <p className="text-muted-foreground">Generate beautiful, comprehensive reports for owners, investors, and business analysis</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Report Settings</Button>
            <Button variant="outline">Owner Portal</Button>
            <Button variant="outline">Schedule Manager</Button>
            <Button>Custom Report</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">24</h3>
              <p className="text-sm text-muted-foreground">Reports Generated</p>
              <p className="text-xs text-success mt-1">+12% this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <Share2 className="h-5 w-5 text-success" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">89</h3>
              <p className="text-sm text-muted-foreground">Auto Deliveries</p>
              <p className="text-xs text-muted-foreground mt-1">Next: Feb 1st</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-chart-3/10">
                  <Eye className="h-5 w-5 text-chart-3" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">156</h3>
              <p className="text-sm text-muted-foreground">Total Views</p>
              <p className="text-xs text-warning mt-1">3 pending reviews</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-warning/10">
                  <FileText className="h-5 w-5 text-warning" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">5</h3>
              <p className="text-sm text-muted-foreground">Scheduled Reports</p>
              <p className="text-xs text-muted-foreground mt-1">All automated</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Templates */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Pre-Built Report Templates</h2>
            <p className="text-sm text-muted-foreground">6 Templates Available</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportTemplates.map((template, index) => {
              const Icon = template.icon;
              return (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-start gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">{template.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {template.category}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
                    
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Generated</span>
                        <span className="font-medium">{template.lastGenerated}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recipients</span>
                        <span className="font-medium">{template.recipients}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Format</span>
                        <span className="font-medium">{template.format}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 gap-2"
                        onClick={() => handleGenerateReport(index, template.title)}
                      >
                        <Download className="h-4 w-4" />
                        Generate
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
