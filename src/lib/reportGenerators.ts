import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const addHeader = (doc: jsPDF, title: string, subtitle: string) => {
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 30);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(subtitle, 20, 40);
  
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(`Generated: ${formatDate(new Date())}`, 20, 50);
  
  doc.setDrawColor(200);
  doc.line(20, 55, 190, 55);
};

const addFooter = (doc: jsPDF, pageNum: number) => {
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(`Page ${pageNum}`, 105, 290, { align: 'center' });
  doc.text('Confidential - For Internal Use Only', 105, 285, { align: 'center' });
};

export const generateOwnerMonthlyStatement = () => {
  const doc = new jsPDF();
  
  addHeader(doc, 'Owner Monthly Statement', 'Financial Report - January 2024');
  
  // Summary Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 20, 70);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('This report provides a comprehensive breakdown of income, expenses, and cash flow', 20, 80);
  doc.text('for all properties under management during the reporting period.', 20, 86);
  
  // Income Table
  autoTable(doc, {
    startY: 95,
    head: [['Income Category', 'Amount', 'YTD Total']],
    body: [
      ['Rental Income', '$45,250.00', '$542,000.00'],
      ['Late Fees', '$350.00', '$2,100.00'],
      ['Parking Revenue', '$1,200.00', '$14,400.00'],
      ['Other Income', '$500.00', '$6,000.00'],
    ],
    foot: [['Total Income', '$47,300.00', '$564,500.00']],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [34, 197, 94], fontStyle: 'bold' },
  });
  
  // Expense Table
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Expense Category', 'Amount', 'YTD Total']],
    body: [
      ['Mortgage Payments', '$18,500.00', '$222,000.00'],
      ['Property Taxes', '$3,200.00', '$38,400.00'],
      ['Insurance', '$1,100.00', '$13,200.00'],
      ['Maintenance & Repairs', '$2,450.00', '$29,400.00'],
      ['Utilities', '$890.00', '$10,680.00'],
      ['Management Fees', '$2,365.00', '$28,380.00'],
    ],
    foot: [['Total Expenses', '$28,505.00', '$342,060.00']],
    theme: 'striped',
    headStyles: { fillColor: [239, 68, 68] },
    footStyles: { fillColor: [239, 68, 68], fontStyle: 'bold' },
  });
  
  // Net Income
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Net Operating Income', 20, finalY);
  doc.setFontSize(18);
  doc.setTextColor(34, 197, 94);
  doc.text('$18,795.00', 20, finalY + 10);
  doc.setTextColor(0);
  
  addFooter(doc, 1);
  
  doc.save('Owner_Monthly_Statement.pdf');
};

export const generatePortfolioPerformanceSummary = () => {
  const doc = new jsPDF();
  
  addHeader(doc, 'Portfolio Performance Summary', 'Analytics Report - Q4 2024');
  
  // KPI Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Performance Indicators', 20, 70);
  
  autoTable(doc, {
    startY: 80,
    head: [['Metric', 'Current', 'Previous Period', 'Change']],
    body: [
      ['Portfolio Value', '$2,450,000', '$2,380,000', '+2.9%'],
      ['Average Cap Rate', '7.2%', '6.8%', '+0.4%'],
      ['Cash on Cash Return', '9.5%', '8.9%', '+0.6%'],
      ['Occupancy Rate', '94%', '91%', '+3%'],
      ['Average Rent/Unit', '$1,850', '$1,780', '+3.9%'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  // Property Performance
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Property', 'Units', 'Occupancy', 'NOI', 'ROI']],
    body: [
      ['Sunset Apartments', '12', '100%', '$8,500', '8.2%'],
      ['Oak Street Duplex', '2', '100%', '$2,100', '7.8%'],
      ['Downtown Condos', '8', '87.5%', '$6,200', '9.1%'],
      ['Maple Grove Complex', '24', '95.8%', '$15,400', '10.2%'],
      ['Harbor View Suites', '6', '83.3%', '$4,800', '7.5%'],
    ],
    foot: [['Portfolio Total', '52', '94%', '$37,000', '8.6%']],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [34, 197, 94], fontStyle: 'bold' },
  });
  
  // Recommendations
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommendations', 20, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('• Consider rent increases for properties below market rate', 25, finalY + 10);
  doc.text('• Focus marketing efforts on Harbor View Suites to improve occupancy', 25, finalY + 17);
  doc.text('• Review maintenance costs at Maple Grove Complex', 25, finalY + 24);
  
  addFooter(doc, 1);
  
  doc.save('Portfolio_Performance_Summary.pdf');
};

export const generateTenantPaymentAnalysis = () => {
  const doc = new jsPDF();
  
  addHeader(doc, 'Tenant Payment Analysis', 'Collection Insights Report - January 2024');
  
  // Payment Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Payment Collection Summary', 20, 70);
  
  autoTable(doc, {
    startY: 80,
    head: [['Status', 'Count', 'Amount', '% of Total']],
    body: [
      ['Paid On Time', '42', '$78,540', '84%'],
      ['Paid Late (1-5 days)', '5', '$9,350', '10%'],
      ['Paid Late (6-15 days)', '2', '$3,740', '4%'],
      ['Outstanding', '1', '$1,870', '2%'],
    ],
    foot: [['Total', '50', '$93,500', '100%']],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
  });
  
  // Payment Trends
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Month', 'On-Time %', 'Late %', 'Outstanding %', 'Total Collected']],
    body: [
      ['January 2024', '84%', '14%', '2%', '$93,500'],
      ['December 2023', '88%', '10%', '2%', '$92,800'],
      ['November 2023', '82%', '15%', '3%', '$91,200'],
      ['October 2023', '86%', '12%', '2%', '$90,500'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  // Delinquency Details
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Current Delinquencies', 20, finalY);
  
  autoTable(doc, {
    startY: finalY + 10,
    head: [['Tenant', 'Property', 'Amount Due', 'Days Late', 'Status']],
    body: [
      ['John Smith', 'Unit 4B - Sunset Apts', '$1,870', '12', 'Payment Plan'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [239, 68, 68] },
  });
  
  addFooter(doc, 1);
  
  doc.save('Tenant_Payment_Analysis.pdf');
};

export const generateMaintenanceCostAnalysis = () => {
  const doc = new jsPDF();
  
  addHeader(doc, 'Maintenance Cost Analysis', 'Operations Report - January 2024');
  
  // Cost by Category
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Costs by Category', 20, 70);
  
  autoTable(doc, {
    startY: 80,
    head: [['Category', 'Count', 'Total Cost', 'Avg Cost', '% of Budget']],
    body: [
      ['Plumbing', '12', '$4,850', '$404', '28%'],
      ['Electrical', '8', '$3,200', '$400', '18%'],
      ['HVAC', '5', '$4,100', '$820', '24%'],
      ['Appliances', '15', '$2,800', '$187', '16%'],
      ['General Repairs', '22', '$2,450', '$111', '14%'],
    ],
    foot: [['Total', '62', '$17,400', '$281', '100%']],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
  });
  
  // Cost by Property
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Property', 'Requests', 'Total Cost', 'Cost/Unit', 'Trend']],
    body: [
      ['Sunset Apartments', '18', '$5,200', '$433', '↓ -12%'],
      ['Oak Street Duplex', '4', '$1,100', '$550', '↑ +8%'],
      ['Downtown Condos', '15', '$4,800', '$600', '→ 0%'],
      ['Maple Grove Complex', '20', '$5,100', '$213', '↓ -5%'],
      ['Harbor View Suites', '5', '$1,200', '$200', '↑ +15%'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  // Vendor Performance
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Top Vendors by Performance', 20, finalY);
  
  autoTable(doc, {
    startY: finalY + 10,
    head: [['Vendor', 'Jobs', 'Avg Response', 'Rating', 'Total Paid']],
    body: [
      ['ABC Plumbing', '12', '2.5 hrs', '4.8/5', '$4,850'],
      ['Quick Electric', '8', '3.0 hrs', '4.6/5', '$3,200'],
      ['Cool Air HVAC', '5', '4.0 hrs', '4.9/5', '$4,100'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
  });
  
  addFooter(doc, 1);
  
  doc.save('Maintenance_Cost_Analysis.pdf');
};

export const generateVacancyReport = () => {
  const doc = new jsPDF();
  
  addHeader(doc, 'Vacancy Report', 'Analytics Report - January 2024');
  
  // Current Vacancies
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Current Vacancy Status', 20, 70);
  
  autoTable(doc, {
    startY: 80,
    head: [['Property', 'Total Units', 'Occupied', 'Vacant', 'Vacancy Rate']],
    body: [
      ['Sunset Apartments', '12', '12', '0', '0%'],
      ['Oak Street Duplex', '2', '2', '0', '0%'],
      ['Downtown Condos', '8', '7', '1', '12.5%'],
      ['Maple Grove Complex', '24', '23', '1', '4.2%'],
      ['Harbor View Suites', '6', '5', '1', '16.7%'],
    ],
    foot: [['Portfolio Total', '52', '49', '3', '5.8%']],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
  });
  
  // Vacant Unit Details
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Unit', 'Property', 'Days Vacant', 'Market Rent', 'Status']],
    body: [
      ['Unit 3A', 'Downtown Condos', '15', '$2,100', 'Listed'],
      ['Unit 12B', 'Maple Grove', '8', '$1,650', 'Application Pending'],
      ['Unit 2C', 'Harbor View', '22', '$1,950', 'Under Renovation'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11] },
  });
  
  // Market Comparison
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Market Comparison', 20, finalY);
  
  autoTable(doc, {
    startY: finalY + 10,
    head: [['Metric', 'Your Portfolio', 'Market Avg', 'Variance']],
    body: [
      ['Vacancy Rate', '5.8%', '7.2%', '-1.4%'],
      ['Avg Days to Lease', '18', '25', '-7 days'],
      ['Avg Rent/Unit', '$1,850', '$1,720', '+$130'],
      ['Lease Renewal Rate', '78%', '72%', '+6%'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
  });
  
  addFooter(doc, 1);
  
  doc.save('Vacancy_Report.pdf');
};

export const generateYearEndTaxSummary = () => {
  const doc = new jsPDF();
  
  addHeader(doc, 'Year-End Tax Summary', 'Tax Preparation Documentation - FY 2023');
  
  // Income Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Annual Income Summary', 20, 70);
  
  autoTable(doc, {
    startY: 80,
    head: [['Income Category', 'Q1', 'Q2', 'Q3', 'Q4', 'Annual Total']],
    body: [
      ['Rental Income', '$135,000', '$138,500', '$142,000', '$146,500', '$562,000'],
      ['Late Fees', '$520', '$480', '$550', '$550', '$2,100'],
      ['Parking Revenue', '$3,600', '$3,600', '$3,600', '$3,600', '$14,400'],
      ['Other Income', '$1,500', '$1,500', '$1,500', '$1,500', '$6,000'],
    ],
    foot: [['Total Income', '$140,620', '$144,080', '$147,650', '$152,150', '$584,500']],
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
    footStyles: { fillColor: [34, 197, 94], fontStyle: 'bold' },
  });
  
  // Deductible Expenses
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Expense Category', 'Annual Total', 'Deductible %', 'Tax Deduction']],
    body: [
      ['Mortgage Interest', '$45,200', '100%', '$45,200'],
      ['Property Taxes', '$38,400', '100%', '$38,400'],
      ['Insurance Premiums', '$13,200', '100%', '$13,200'],
      ['Repairs & Maintenance', '$29,400', '100%', '$29,400'],
      ['Management Fees', '$28,380', '100%', '$28,380'],
      ['Depreciation', '$42,000', '100%', '$42,000'],
      ['Utilities', '$10,680', '100%', '$10,680'],
      ['Professional Services', '$4,800', '100%', '$4,800'],
    ],
    foot: [['Total Deductions', '$212,060', '', '$212,060']],
    theme: 'grid',
    headStyles: { fillColor: [239, 68, 68] },
    footStyles: { fillColor: [239, 68, 68], fontStyle: 'bold' },
  });
  
  // Net Taxable Income
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Net Taxable Income', 20, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Income: $584,500', 25, finalY + 10);
  doc.text('Less: Deductions: ($212,060)', 25, finalY + 17);
  doc.setFont('helvetica', 'bold');
  doc.text('Net Taxable Income: $372,440', 25, finalY + 27);
  
  // Important Notes
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Important Notes', 20, finalY + 42);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('• This summary is for informational purposes only. Consult a tax professional.', 25, finalY + 52);
  doc.text('• All amounts are subject to verification with original documentation.', 25, finalY + 59);
  doc.text('• Depreciation calculated using straight-line method over 27.5 years.', 25, finalY + 66);
  
  addFooter(doc, 1);
  
  doc.save('Year_End_Tax_Summary.pdf');
};
