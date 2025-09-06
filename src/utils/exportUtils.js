import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import XLSX from 'xlsx';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { getWorkerBalance } from './balance';

// App theme colors
const THEME_COLORS = {
  primary: '#2c3e50',
  secondary: '#3498db', 
  success: '#27ae60',
  danger: '#e74c3c',
  warning: '#f39c12',
  light: '#ecf0f1',
  dark: '#34495e'
};

// Export data processing utilities
export class ExportDataProcessor {
  constructor(state) {
    try {
      if (!state || typeof state !== 'object') {
        throw new Error('Valid state object is required for ExportDataProcessor');
      }
      
      this.state = state;
      this.workers = Array.isArray(state.workers) ? state.workers : [];
      this.entries = Array.isArray(state.entries) ? state.entries : [];
      this.payments = Array.isArray(state.payments) ? state.payments : [];
      this.categories = Array.isArray(state.categories) ? state.categories : [];
      this.subcategories = Array.isArray(state.subcategories) ? state.subcategories : [];
      
      console.log('ExportDataProcessor initialized:', {
        workers: this.workers.length,
        entries: this.entries.length,
        payments: this.payments.length,
        categories: this.categories.length,
        subcategories: this.subcategories.length
      });
    } catch (error) {
      console.error('Error initializing ExportDataProcessor:', error);
      this.state = {};
      this.workers = [];
      this.entries = [];
      this.payments = [];
      this.categories = [];
      this.subcategories = [];
    }
  }

  // Filter data by date range
  filterByDateRange(data, fromDate, toDate) {
    try {
      if (!data || !Array.isArray(data)) return [];
      if (!fromDate && !toDate) return data;
      
      const from = fromDate ? startOfMonth(fromDate) : new Date('2020-01-01');
      const to = toDate ? endOfMonth(toDate) : new Date();
      
      return data.filter(item => {
        if (!item || !item.date) return false;
        try {
          const itemDate = parseISO(item.date);
          return isWithinInterval(itemDate, { start: from, end: to });
        } catch (dateError) {
          console.warn('Invalid date format:', item.date);
          return false;
        }
      });
    } catch (error) {
      console.error('Error filtering by date range:', error);
      return data || [];
    }
  }

  // Get comprehensive worker data for export
  getWorkerExportData(workerId = null, fromDate = null, toDate = null) {
    try {
      if (!this.workers || !Array.isArray(this.workers)) {
        console.warn('No workers data available for export');
        return [];
      }
      
      const targetWorkers = workerId ? [this.workers.find(w => w.id === workerId)] : this.workers;
      const filteredEntries = this.filterByDateRange(this.entries || [], fromDate, toDate);
      const filteredPayments = this.filterByDateRange(this.payments || [], fromDate, toDate);

      return targetWorkers.filter(Boolean).map(worker => {
        const workerEntries = filteredEntries.filter(e => e.workerId === worker.id);
        const workerPayments = filteredPayments.filter(p => p.workerId === worker.id);
        
        // Calculate attendance summary
        const attendanceSummary = this.calculateAttendanceSummary(workerEntries);
        
        // Calculate financial summary
        const totalEarnings = workerEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
        const totalPayments = workerPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        let currentBalance = 0;
        
        try {
          currentBalance = getWorkerBalance(worker.id, this.state);
        } catch (balanceError) {
          console.error('Error calculating worker balance:', balanceError);
          currentBalance = totalEarnings - totalPayments; // fallback calculation
        }

        // NEW: Generate day-wise breakdown
        const dayWiseData = this.generateDayWiseBreakdown(worker.id, workerEntries, workerPayments, fromDate, toDate);

        return {
          worker,
          entries: workerEntries.sort((a, b) => new Date(b.date) - new Date(a.date)),
          payments: workerPayments.sort((a, b) => new Date(b.date) - new Date(a.date)),
          dayWiseData, // NEW: Day-wise breakdown
          summary: {
            ...attendanceSummary,
            totalEarnings,
            totalPayments,
            currentBalance,
            totalWorkingDays: workerEntries.length
          }
        };
      });
    } catch (error) {
      console.error('Error getting worker export data:', error);
      return [];
    }
  }

  // Calculate detailed attendance summary
  calculateAttendanceSummary(entries) {
    try {
      const summary = { present: 0, halfDay: 0, absent: 0, overtime: 0 };
      const categoryBreakdown = {};

      if (!Array.isArray(entries)) {
        console.warn('Invalid entries array in calculateAttendanceSummary');
        return { ...summary, categoryBreakdown };
      }

      entries.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
          console.warn('Invalid entry object:', entry);
          return;
        }
        
        // Attendance status
        switch (entry.status) {
          case 'P': summary.present++; break;
          case 'H': summary.halfDay++; break;
          case 'A': summary.absent++; break;
          case 'O': summary.overtime++; break;
        }

        // Category breakdown
        const category = this.categories.find(c => c.id === entry.categoryId);
        const categoryName = category?.category || 'Unknown';
        
        if (!categoryBreakdown[categoryName]) {
          categoryBreakdown[categoryName] = { count: 0, amount: 0 };
        }
        categoryBreakdown[categoryName].count++;
        categoryBreakdown[categoryName].amount += entry.amount || 0;
      });

      return { ...summary, categoryBreakdown };
    } catch (error) {
      console.error('Error calculating attendance summary:', error);
      return { present: 0, halfDay: 0, absent: 0, overtime: 0, categoryBreakdown: {} };
    }
  }

  // NEW: Generate day-wise breakdown with running balance
  generateDayWiseBreakdown(workerId, entries, payments, fromDate, toDate) {
    try {
      // Get all dates that have entries or payments
      const allDates = new Set();
      entries.forEach(e => allDates.add(e.date));
      payments.forEach(p => allDates.add(p.date));
      
      // Sort dates chronologically
      const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
      
      // Calculate opening balance (balance before the date range)
      let runningBalance = 0;
      try {
        // Get worker's total balance up to the start date
        const allWorkerEntries = this.entries.filter(e => e.workerId === workerId);
        const allWorkerPayments = this.payments.filter(p => p.workerId === workerId);
        
        if (fromDate) {
          const entriesBeforeRange = allWorkerEntries.filter(e => new Date(e.date) < new Date(fromDate));
          const paymentsBeforeRange = allWorkerPayments.filter(p => new Date(p.date) < new Date(fromDate));
          
          const earningsBeforeRange = entriesBeforeRange.reduce((sum, e) => sum + (e.amount || 0), 0);
          const paymentsBeforeRange_total = paymentsBeforeRange.reduce((sum, p) => sum + (p.amount || 0), 0);
          
          runningBalance = earningsBeforeRange - paymentsBeforeRange_total;
        }
      } catch (error) {
        console.warn('Error calculating opening balance:', error);
        runningBalance = 0;
      }

      // Build day-wise data
      const dayWiseData = sortedDates.map(date => {
        const dayEntries = entries.filter(e => e.date === date);
        const dayPayments = payments.filter(p => p.date === date);
        
        const dayEarnings = dayEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
        const dayPaymentTotal = dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const openingBalance = runningBalance;
        const closingBalance = openingBalance + dayEarnings - dayPaymentTotal;
        runningBalance = closingBalance;

        return {
          date,
          openingBalance,
          entries: dayEntries.map(e => ({
            ...e,
            categoryName: this.categories.find(c => c.id === e.categoryId)?.category || 'Unknown',
            subcategoryName: this.subcategories.find(s => s.id === e.subcategoryId)?.subcategoryName || 'N/A'
          })),
          payments: dayPayments,
          dayEarnings,
          dayPaymentTotal,
          closingBalance,
          netChange: dayEarnings - dayPaymentTotal
        };
      });

      return {
        openingBalance: dayWiseData[0]?.openingBalance || 0,
        closingBalance: dayWiseData[dayWiseData.length - 1]?.closingBalance || 0,
        dailyData: dayWiseData,
        totalDays: dayWiseData.length
      };
    } catch (error) {
      console.error('Error generating day-wise breakdown:', error);
      return {
        openingBalance: 0,
        closingBalance: 0,
        dailyData: [],
        totalDays: 0
      };
    }
  }

  // Format currency for display
  formatCurrency(amount) {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(amount || 0);
    } catch (error) {
      console.error('Error formatting currency:', error, amount);
      return `₹${(amount || 0).toFixed(2)}`;
    }
  }

  // Format date for display
  formatDate(dateString) {
    try {
      return format(parseISO(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  }
}

// Excel Export Handler
export class ExcelExporter {
  constructor(processor) {
    this.processor = processor;
  }

  async exportToExcel(workerId = null, fromDate = null, toDate = null, filename = null) {
    try {
      console.log('📊 Starting Excel export...');
      
      const data = this.processor.getWorkerExportData(workerId, fromDate, toDate);
      const workbook = XLSX.utils.book_new();

      // Create summary sheet
      this.createSummarySheet(workbook, data, fromDate, toDate);

      // Create detailed sheets for each worker
      data.forEach((workerData, index) => {
        this.createWorkerDetailSheet(workbook, workerData, index);
      });

      // Generate filename if not provided
      if (!filename) {
        const dateRange = this.getDateRangeString(fromDate, toDate);
        const workerPart = workerId ? `_${data[0]?.worker?.name?.replace(/\s+/g, '_')}` : '_AllWorkers';
        filename = `HLM_Report${workerPart}_${dateRange}.xlsx`;
      }

      // Write file
      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const uri = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('✅ Excel file created:', filename);
      return { success: true, uri, filename };

    } catch (error) {
      console.error('❌ Excel export failed:', error);
      return { success: false, error: error.message };
    }
  }

  createSummarySheet(workbook, data, fromDate, toDate) {
    const summaryData = [
      ['House Labour Management - Summary Report'],
      ['Generated:', new Date().toLocaleString()],
      ['Date Range:', this.getDateRangeString(fromDate, toDate)],
      ['Workers:', data.length],
      [''], // Empty row
      
      // Headers
      ['Worker Name', 'Phone', 'Present Days', 'Half Days', 'Absent Days', 'Total Earnings', 'Total Payments', 'Current Balance'],
      
      // Data rows
      ...data.map(({ worker, summary }) => [
        worker.name || 'Unknown',
        worker.phone || 'N/A',
        summary.present,
        summary.halfDay,
        summary.absent,
        summary.totalEarnings,
        summary.totalPayments,
        summary.currentBalance
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths
    ws['!cols'] = [
      { width: 20 }, // Worker Name
      { width: 15 }, // Phone  
      { width: 12 }, // Present
      { width: 12 }, // Half Days
      { width: 12 }, // Absent
      { width: 15 }, // Earnings
      { width: 15 }, // Payments
      { width: 15 }  // Balance
    ];

    // Apply styles (Excel will format these)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({r: R, c: C})];
        if (!cell) continue;
        
        // Header row styling
        if (R === 5) {
          cell.s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2C3E50" } },
            alignment: { horizontal: "center" }
          };
        }
        
        // Number formatting for currency columns
        if ((C >= 5 && C <= 7) && R > 5) {
          cell.z = '#,##0.00';
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, ws, 'Summary');
  }

  createWorkerDetailSheet(workbook, workerData, index) {
    const { worker, entries, payments, summary, dayWiseData } = workerData;
    const sheetName = `${worker.name?.substring(0, 20) || 'Worker'}_${index + 1}`;

    const detailData = [
      [`${worker.name || 'Unknown Worker'} - Detailed Report`],
      ['Phone:', worker.phone || 'N/A'],
      ['Email:', worker.email || 'N/A'],
      ['Current Balance:', this.processor.formatCurrency(summary.currentBalance)],
      [''], // Empty row

      // Attendance Summary
      ['ATTENDANCE SUMMARY'],
      ['Present Days:', summary.present],
      ['Half Days:', summary.halfDay], 
      ['Absent Days:', summary.absent],
      ['Overtime Days:', summary.overtime],
      ['Total Working Days:', summary.totalWorkingDays],
      [''], // Empty row

      // Financial Summary
      ['FINANCIAL SUMMARY'],
      ['Total Earnings:', this.processor.formatCurrency(summary.totalEarnings)],
      ['Total Payments:', this.processor.formatCurrency(summary.totalPayments)],
      ['Current Balance:', this.processor.formatCurrency(summary.currentBalance)],
      [''], // Empty row

      // NEW: Day-wise Breakdown
      ['DAY-WISE BREAKDOWN'],
      ['Date', 'Opening Balance', 'Entries Amount', 'Payment Amount', 'Net Change', 'Closing Balance', 'Details'],
      
      // Day-wise data rows
      ...dayWiseData.dailyData.map(day => [
        this.processor.formatDate(day.date),
        day.openingBalance,
        day.dayEarnings,
        day.dayPaymentTotal,
        day.netChange,
        day.closingBalance,
        `${day.entries.length} entries, ${day.payments.length} payments`
      ]),
      
      [''], // Empty row
      ['Total Days with Activity:', dayWiseData.totalDays],
      ['Period Opening Balance:', dayWiseData.openingBalance],
      ['Period Closing Balance:', dayWiseData.closingBalance],
      [''], // Empty row

      // Entries Header
      ['WORK ENTRIES'],
      ['Date', 'Category', 'Subcategory', 'Status', 'Amount', 'Notes'],
      
      // Entry rows
      ...entries.map(entry => {
        const category = this.processor.categories.find(c => c.id === entry.categoryId);
        const subcategory = this.processor.subcategories.find(s => s.id === entry.subcategoryId);
        return [
          this.processor.formatDate(entry.date),
          category?.category || 'Unknown',
          subcategory?.subcategoryName || 'N/A',
          this.getStatusText(entry.status),
          entry.amount || 0,
          entry.notes || ''
        ];
      }),
      
      [''], // Empty row
      ['PAYMENTS'],
      ['Date', 'Amount', 'Type', 'Notes'],
      
      // Payment rows
      ...payments.map(payment => [
        this.processor.formatDate(payment.date),
        payment.amount || 0,
        payment.paymentType || 'Cash',
        payment.notes || ''
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(detailData);
    
    // Set column widths
    ws['!cols'] = [
      { width: 15 }, // Date/Label
      { width: 20 }, // Category/Amount
      { width: 15 }, // Subcategory/Type
      { width: 12 }, // Status
      { width: 12 }, // Amount
      { width: 30 }  // Notes
    ];

    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }  getStatusText(status) {
    switch (status) {
      case 'P': return 'Present';
      case 'H': return 'Half Day';
      case 'A': return 'Absent';
      case 'O': return 'Overtime';
      default: return status || 'Unknown';
    }
  }

  getDateRangeString(fromDate, toDate) {
    try {
      if (!fromDate && !toDate) return 'All_Time';
      if (fromDate && !toDate) return `From_${format(fromDate, 'yyyy-MM-dd')}`;
      if (!fromDate && toDate) return `Until_${format(toDate, 'yyyy-MM-dd')}`;
      return `${format(fromDate, 'yyyy-MM-dd')}_to_${format(toDate, 'yyyy-MM-dd')}`;
    } catch (error) {
      console.error('Error formatting date range:', error);
      return 'Date_Range_Error';
    }
  }
}

// PDF Export Handler  
export class PDFExporter {
  constructor(processor) {
    this.processor = processor;
  }

  async exportToPDF(workerId = null, fromDate = null, toDate = null, filename = null) {
    try {
      console.log('📄 Starting PDF export...');
      
      // Check if Print is available
      if (!Print || !Print.printToFileAsync) {
        console.warn('⚠️ expo-print is not available. PDF export requires a development build or bare workflow.');
        return { 
          success: false, 
          error: 'PDF export is not available in Expo Go. Please use a development build or export for production.'
        };
      }
      
      const data = this.processor.getWorkerExportData(workerId, fromDate, toDate);
      console.log('📄 Got export data, generating HTML...');
      
      const htmlContent = this.generatePDFHTML(data, fromDate, toDate);
      console.log('📄 HTML generated, creating PDF...');

      // Generate filename if not provided
      if (!filename) {
        const dateRange = this.processor.getDateRangeString(fromDate, toDate);
        const workerPart = workerId ? `_${data[0]?.worker?.name?.replace(/\s+/g, '_')}` : '_AllWorkers';
        filename = `HLM_Report${workerPart}_${dateRange}.pdf`;
      }

      console.log('📄 Creating PDF with filename:', filename);
      
      // Use the proper expo-print API with error handling
      const printResult = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      if (!printResult || !printResult.uri) {
        throw new Error('Failed to generate PDF file');
      }

      console.log('✅ PDF file created:', printResult.uri);
      return { success: true, uri: printResult.uri, filename };

    } catch (error) {
      console.error('❌ PDF export failed:', error);
      console.error('❌ PDF export error stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  generatePDFHTML(data, fromDate, toDate) {
    try {
      console.log('📄 Generating PDF HTML...');
      const dateRangeText = this.getDateRangeText(fromDate, toDate);
      console.log('📄 Date range text:', dateRangeText);
      
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>House Labour Management Report</title>
            <style>
              ${this.getPDFStyles()}
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🏠 House Labour Management</h1>
              <h2>Worker Report</h2>
              <div class="report-info">
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Period:</strong> ${dateRangeText}</p>
                <p><strong>Workers:</strong> ${data.length}</p>
              </div>
            </div>

            ${this.generateSummaryTable(data)}
            
            ${data.map(workerData => this.generateWorkerDetailSection(workerData)).join('')}
            
            <div class="footer">
              <p>Generated by House Labour Management System | ${new Date().toLocaleDateString()}</p>
            </div>
          </body>
        </html>
      `;
    } catch (error) {
      console.error('❌ Error generating PDF HTML:', error);
      throw error;
    }
  }

  getDateRangeText(fromDate, toDate) {
    try {
      if (!fromDate && !toDate) return 'All Time';
      if (fromDate && !toDate) return `From ${format(fromDate, 'dd/MM/yyyy')}`;
      if (!fromDate && toDate) return `Until ${format(toDate, 'dd/MM/yyyy')}`;
      return `${format(fromDate, 'dd/MM/yyyy')} - ${format(toDate, 'dd/MM/yyyy')}`;
    } catch (error) {
      console.error('Error formatting date range for PDF:', error);
      return 'Date Range';
    }
  }

  getPDFStyles() {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #2c3e50;
        background: #ffffff;
        padding: 30px;
        font-size: 14px;
      }
      
      .header {
        text-align: center;
        margin-bottom: 40px;
        padding: 30px 0;
        border-bottom: 3px solid #3498db;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 10px;
        margin: -20px -20px 30px -20px;
        padding: 40px 20px;
      }
      
      .header h1 {
        color: #2c3e50;
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 8px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      
      .header h2 {
        color: #3498db;
        font-size: 20px;
        font-weight: 500;
        margin-bottom: 20px;
      }
      
      .report-info {
        background: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        display: inline-block;
      }
      
      .report-info p {
        margin: 5px 0;
        font-size: 14px;
        color: #34495e;
      }
      
      .report-info strong {
        color: #2c3e50;
        font-weight: 600;
      }
      
      /* Summary Table Styles */
      .summary-section {
        margin: 30px 0;
      }
      
      .section-title {
        color: #2c3e50;
        font-size: 22px;
        font-weight: 600;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #3498db;
        display: flex;
        align-items: center;
      }
      
      .section-title:before {
        content: '▶';
        color: #3498db;
        margin-right: 10px;
        font-size: 18px;
      }
      
      /* Table Styles */
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        background: #ffffff;
        box-shadow: 0 2px 15px rgba(0,0,0,0.08);
        border-radius: 10px;
        overflow: hidden;
      }
      
      thead {
        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
        color: white;
      }
      
      th {
        padding: 15px 12px;
        text-align: left;
        font-weight: 600;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      td {
        padding: 12px;
        border-bottom: 1px solid #ecf0f1;
        font-size: 13px;
      }
      
      tbody tr:hover {
        background-color: #f8f9fa;
      }
      
      tbody tr:last-child td {
        border-bottom: none;
      }
      
      .currency {
        text-align: right;
        font-weight: 600;
        font-family: 'Courier New', monospace;
      }
      
      /* Worker Section Styles */
      .worker-section {
        margin: 40px 0;
        page-break-inside: avoid;
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        border: 1px solid #e9ecef;
      }
      
      .worker-header {
        background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
        color: white;
        padding: 25px;
        text-align: center;
      }
      
      .worker-name {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 8px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      
      .worker-info {
        font-size: 14px;
        opacity: 0.9;
        font-weight: 400;
      }
      
      /* Stats Grid */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        padding: 25px;
        background: #f8f9fa;
      }
      
      .stat-card {
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        border: 1px solid #e9ecef;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        transition: transform 0.2s ease;
      }
      
      .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      }
      
      .stat-title {
        font-size: 11px;
        font-weight: 600;
        color: #7f8c8d;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
      }
      
      .stat-value {
        font-size: 18px;
        font-weight: 700;
        color: #2c3e50;
      }
      
      .stat-value.currency {
        font-family: 'Courier New', monospace;
        color: #27ae60;
      }
      
      .stat-value.status-present {
        color: #27ae60;
      }
      
      /* Status Classes */
      .status-present {
        color: #27ae60;
        font-weight: 600;
      }
      
      .status-half {
        color: #f39c12;
        font-weight: 600;
      }
      
      .status-absent {
        color: #e74c3c;
        font-weight: 600;
      }
      
      .status-overtime {
        color: #9b59b6;
        font-weight: 600;
      }
      
      /* Footer */
      .footer {
        margin-top: 50px;
        text-align: center;
        padding: 25px;
        background: linear-gradient(135deg, #ecf0f1 0%, #d5dbdb 100%);
        border-radius: 10px;
        color: #7f8c8d;
        font-size: 12px;
        border: 1px solid #bdc3c7;
      }
      
      .footer p {
        margin: 0;
        font-weight: 500;
      }
      
      /* Responsive adjustments for print */
      @media print {
        body {
          padding: 15px;
          font-size: 12px;
        }
        
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        
        .worker-section {
          page-break-inside: avoid;
        }
        
        .header {
          margin: -10px -10px 20px -10px;
          padding: 20px 10px;
        }
        
        table {
          font-size: 11px;
        }
        
        th, td {
          padding: 8px;
        }
      }
      
      /* Utility Classes */
      .text-center {
        text-align: center;
      }
      
      .text-right {
        text-align: right;
      }
      
      .font-bold {
        font-weight: 700;
      }
      
      .mb-20 {
        margin-bottom: 20px;
      }
      
      .mt-30 {
        margin-top: 30px;
      }
    `;
  }

  generateSummaryTable(data) {
    return `
      <div class="summary-section">
        <h3 class="section-title">📊 Summary Overview</h3>
        <table>
          <thead>
            <tr>
              <th>Worker Name</th>
              <th>Phone</th>
              <th>Present</th>
              <th>Half Days</th>
              <th>Absent</th>
              <th>Total Earnings</th>
              <th>Total Payments</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(({ worker, summary }) => `
              <tr>
                <td><strong>${worker.name || 'Unknown'}</strong></td>
                <td>${worker.phone || 'N/A'}</td>
                <td class="status-present">${summary.present}</td>
                <td class="status-half">${summary.halfDay}</td>
                <td class="status-absent">${summary.absent}</td>
                <td class="currency">${this.processor.formatCurrency(summary.totalEarnings)}</td>
                <td class="currency">${this.processor.formatCurrency(summary.totalPayments)}</td>
                <td class="currency">${this.processor.formatCurrency(summary.currentBalance)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  generateWorkerDetailSection(workerData) {
    const { worker, entries, payments, summary, dayWiseData } = workerData;
    
    return `
      <div class="worker-section">
        <div class="worker-header">
          <h3 class="worker-name">👤 ${worker.name || 'Unknown Worker'}</h3>
          <div class="worker-info">📱 ${worker.phone || 'No phone'} | 📧 ${worker.email || 'No email'}</div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-title">CURRENT BALANCE</div>
            <div class="stat-value currency">${this.processor.formatCurrency(summary.currentBalance)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">PRESENT DAYS</div>
            <div class="stat-value status-present">${summary.present}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">TOTAL EARNINGS</div>
            <div class="stat-value currency">${this.processor.formatCurrency(summary.totalEarnings)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">TOTAL PAYMENTS</div>
            <div class="stat-value currency">${this.processor.formatCurrency(summary.totalPayments)}</div>
          </div>
        </div>

        ${dayWiseData && dayWiseData.dailyData.length > 0 ? `
          <h4 class="section-title">📅 Day-wise Breakdown</h4>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Opening Balance</th>
                <th>Entries</th>
                <th>Payments</th>
                <th>Net Change</th>
                <th>Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              ${dayWiseData.dailyData.slice(0, 30).map(day => `
                <tr>
                  <td><strong>${this.processor.formatDate(day.date)}</strong></td>
                  <td class="currency">${this.processor.formatCurrency(day.openingBalance)}</td>
                  <td class="currency positive">${this.processor.formatCurrency(day.dayEarnings)}</td>
                  <td class="currency negative">${this.processor.formatCurrency(day.dayPaymentTotal)}</td>
                  <td class="currency ${day.netChange >= 0 ? 'positive' : 'negative'}">${this.processor.formatCurrency(day.netChange)}</td>
                  <td class="currency">${this.processor.formatCurrency(day.closingBalance)}</td>
                </tr>
              `).join('')}
              ${dayWiseData.dailyData.length > 30 ? `<tr><td colspan="6" style="text-align: center; font-style: italic;">... and ${dayWiseData.dailyData.length - 30} more days</td></tr>` : ''}
            </tbody>
          </table>
          <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
            <strong>Period Summary:</strong> 
            Opening Balance: ${this.processor.formatCurrency(dayWiseData.openingBalance)} | 
            Closing Balance: ${this.processor.formatCurrency(dayWiseData.closingBalance)} | 
            Active Days: ${dayWiseData.totalDays}
          </div>
        ` : ''}

        ${entries.length > 0 ? `
          <h4 class="section-title">📝 Work Entries</h4>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${entries.slice(0, 20).map(entry => { // Limit to 20 for PDF
                const category = this.processor.categories.find(c => c.id === entry.categoryId);
                const subcategory = this.processor.subcategories.find(s => s.id === entry.subcategoryId);
                const statusClass = this.getStatusClass(entry.status);
                return `
                  <tr>
                    <td>${this.processor.formatDate(entry.date)}</td>
                    <td>${category?.category || 'Unknown'}</td>
                    <td>${subcategory?.subcategoryName || 'N/A'}</td>
                    <td class="${statusClass}">${this.getStatusText(entry.status)}</td>
                    <td class="currency">${this.processor.formatCurrency(entry.amount)}</td>
                    <td>${entry.notes || ''}</td>
                  </tr>
                `;
              }).join('')}
              ${entries.length > 20 ? `<tr><td colspan="6" style="text-align: center; font-style: italic;">... and ${entries.length - 20} more entries</td></tr>` : ''}
            </tbody>
          </table>
        ` : '<p>No work entries found.</p>'}

        ${payments.length > 0 ? `
          <h4 class="section-title">💰 Payments</h4>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${payments.slice(0, 15).map(payment => `
                <tr>
                  <td>${this.processor.formatDate(payment.date)}</td>
                  <td class="currency">${this.processor.formatCurrency(payment.amount)}</td>
                  <td>${payment.paymentType || 'Cash'}</td>
                  <td>${payment.notes || ''}</td>
                </tr>
              `).join('')}
              ${payments.length > 15 ? `<tr><td colspan="4" style="text-align: center; font-style: italic;">... and ${payments.length - 15} more payments</td></tr>` : ''}
            </tbody>
          </table>
        ` : '<p>No payments found.</p>'}
      </div>
    `;
  }

  getStatusClass(status) {
    switch (status) {
      case 'P': return 'status-present';
      case 'H': return 'status-half';
      case 'A': return 'status-absent';
      case 'O': return 'status-overtime';
      default: return '';
    }
  }

  getStatusText(status) {
    switch (status) {
      case 'P': return '✅ Present';
      case 'H': return '⏰ Half Day';
      case 'A': return '❌ Absent';
      case 'O': return '⚡ Overtime';
      default: return status || 'Unknown';
    }
  }
}

// Main Export Manager
export class ExportManager {
  constructor(state) {
    try {
      if (!state) {
        throw new Error('State is required for ExportManager');
      }

      // Validate essential state properties
      if (!state.workers || !Array.isArray(state.workers)) {
        console.warn('Invalid or missing workers array in state');
        state.workers = [];
      }
      
      if (!state.entries || !Array.isArray(state.entries)) {
        console.warn('Invalid or missing entries array in state');
        state.entries = [];
      }
      
      if (!state.payments || !Array.isArray(state.payments)) {
        console.warn('Invalid or missing payments array in state');
        state.payments = [];
      }
      
      if (!state.categories || !Array.isArray(state.categories)) {
        console.warn('Invalid or missing categories array in state');
        state.categories = [];
      }
      
      if (!state.subcategories || !Array.isArray(state.subcategories)) {
        console.warn('Invalid or missing subcategories array in state');
        state.subcategories = [];
      }
      
      this.processor = new ExportDataProcessor(state);
      this.excelExporter = new ExcelExporter(this.processor);
      this.pdfExporter = new PDFExporter(this.processor);
    } catch (error) {
      console.error('Error initializing ExportManager:', error);
      throw error;
    }
  }

  async exportExcel(options = {}) {
    const { workerId, fromDate, toDate, filename } = options;
    const result = await this.excelExporter.exportToExcel(workerId, fromDate, toDate, filename);
    
    if (result.success && await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri);
    }
    
    return result;
  }

  async exportPDF(options = {}) {
    // PDF feature is temporarily disabled
    return {
      success: false,
      error: 'PDF export feature is currently disabled',
      message: 'PDF export functionality is temporarily unavailable. Please use Excel export instead.'
    };
  }

  // Get preview data for export options
  getExportPreview(workerId = null, fromDate = null, toDate = null) {
    try {
      if (!this.processor) {
        throw new Error('Export processor not initialized');
      }
      
      const data = this.processor.getWorkerExportData(workerId, fromDate, toDate);
      
      if (!data || !Array.isArray(data)) {
        return {
          workers: 0,
          entries: 0,
          payments: 0,
          totalEarnings: '₹0.00',
          dateRange: 'No_Data'
        };
      }
      
      const totalWorkers = data.length;
      const totalEntries = data.reduce((sum, w) => sum + (w.entries ? w.entries.length : 0), 0);
      const totalPayments = data.reduce((sum, w) => sum + (w.payments ? w.payments.length : 0), 0);
      const totalEarnings = data.reduce((sum, w) => sum + (w.summary ? w.summary.totalEarnings || 0 : 0), 0);
      
      return {
        workers: totalWorkers,
        entries: totalEntries,
        payments: totalPayments,
        totalEarnings: this.processor.formatCurrency(totalEarnings),
        dateRange: this.processor.getDateRangeString(fromDate, toDate)
      };
    } catch (error) {
      console.error('Error getting export preview:', error);
      return {
        workers: 0,
        entries: 0,
        payments: 0,
        totalEarnings: '₹0.00',
        dateRange: 'Error'
      };
    }
  }
}
